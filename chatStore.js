import {sioAfterCreate, sioMiddleware} from "../../middleware/sioMiddleware"
import {applyPatch, getPath} from "mobx-state-tree"
import channel from "./channels"
import action from "./action"

const send = (store) => sioMiddleware(store, [
    {
        model: 'user',
        action: 'dialogJoin',
        after: ({sio, args}) => sio.emit(
            channel.DIALOG, {
                action: action.JOIN,
                data: {
                    dialogId: args.id
                }
            })
    },
    {
        model: 'user',
        action: 'dialogLeave',
        before: ({store}) => applyPatch(store, {op: 'replace', path: '/joinedDialog', value: undefined}),
        after: ({sio, args}) => args && sio.emit(
            channel.DIALOG, {
                action: action.LEAVE,
                data: {
                    dialogId: args.id
                }
            })
    },
    {
        model: 'dialog',
        action: 'sendMessage',
        before: ({sio, args, instance}) => args.length && sio.emit(
            channel.DIALOG, {
                action: action.WRITE,
                data: {
                    dialogId: instance.id,
                    text: args[0]
                }
            })
    },
    {
        model: 'dialog',
        action: 'readMessage',
        after: ({sio, args, instance}) => args && sio.emit(
            channel.DIALOG, {
                action: action.READ,
                data: {
                    dialogId: instance.id,
                    messageIds: args[0]
                }
            })
    },
])
const receive = (store) => sioAfterCreate(store, (sio, store) => {
    sio.on(channel.CHAT, payload => {  // STATIC
        switch (payload.action) {
            case 'init':
                sio.emit(channel.USERS, {
                    action: action.GET,
                    data: payload.data.map(({id}) => id)
                })
                applyPatch(store, {op: 'replace', path: '/dialogs', value: payload.data})
                break
            default:
                break
        }
    })
    sio.on(channel.USERS, data => { // STATIC
        applyPatch(store, {op: 'replace', path: '/users', value: data})
    })
    sio.on(channel.DIALOG, payload => {
        const dialog = store.getDialog(payload.data.dialogId)
        switch (payload.action) {
            case action.UPDATE: // STATIC
                if (payload.data.message.senderId !== store.id)  // отправленное собеседником
                    dialog.incUnreadMessages()
                dialog.incTotalMessages()
                dialog.setLastMessageSenderId(payload.data.message.senderId)
                dialog.setLastMessageText(payload.data.message.text)
                dialog.setLastMessageTime(payload.data.message.created)
                break
            case action.JOIN: // DYNAMIC
                // TODO: добавлять applyPatch(dialog, {op: 'add', path: '/messages/-', value: payload.data.messages})
                applyPatch(dialog, {op: 'replace', path: '/messages', value: payload.data.messages})
                applyPatch(store, {op: 'replace', path: '/joinedDialog', value: dialog})
                break
            case action.WRITE:  // DYNAMIC
                if (payload.data.message.senderId === store.id) {  // отправленное собой
                    const selfMessage = dialog.messages.find(msg => msg.text === payload.data.message.text && msg.sent)
                    applyPatch(store, {op: 'replace', path: getPath(selfMessage), value: payload.data.message})
                } else  // отправленное собеседником
                    dialog.addMessage(payload.data.message)
                break
            case action.READ: // DYNAMIC
                payload.data.messageIds.forEach(msgId => dialog.messages.find(msg => msg.id === msgId)
                    .setRead())
                dialog.resetUnreadMessages()
                break
            default:
                break
        }
    })
    sio.emit(channel.CHAT, {action: 'init'})  // static
})
const chatStore = (store) => {
    receive(store)
    send(store)
}
export default chatStore