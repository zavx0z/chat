import {sioAfterConnect, sioAfterCreate, sioMiddleware} from "../../middleware/sioMiddleware"
import {applyPatch, getPath} from "mobx-state-tree"
import channel from "./channels"
import action from "./action"
import {notice} from "./controllers/Notice"

const connected = (store) => sioAfterConnect(store, (sio, store) => {
    sio.emit(channel.CHAT, {}, (response) => {
        // console.log(store.dialogs.length)
        console.log([...store.dialogs], response)
        applyPatch(store, {op: 'replace', path: '/dialogs', value: response})
        store.setLoadingDialogs(false)
    })
})

const send = (store) => sioMiddleware(store, [
    {
        model: 'user',
        action: 'dialogJoin',
        after: ({sio, args}) => typeof args !== 'undefined' && sio.emit(
            channel.DIALOG, {
                action: action.JOIN,
                data: {
                    dialogId: args.id,
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
                    dialogId: args.id,
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
                    dialogId: parseInt(instance.id),
                    messageIds: args
                }
            })
    },
])
const receive = (store) => {
    sioAfterCreate(store, (sio, store) => {
        sio.on(channel.CHAT, payload => {  // STATIC
            switch (payload.action) {
                case action.UPDATE:
                    sio.emit(channel.DIALOG, {action: action.JOIN_STATIC, data: {dialogId: payload.data.dialog.id}})
                    payload.data.users.forEach(item => {
                        if (!store.getUser(item.id))
                            applyPatch(store, {op: "add", path: "/users/-", value: item})
                    })
                    if (!store.getDialog(payload.data.dialog.id))
                        applyPatch(store, {op: "add", path: "/dialogs/-", value: payload.data.dialog})
                    break
                default:
                    break
            }
        })
        sio.on(channel.USERS, payload => { // STATIC
            switch (payload.action) {
                case action.UPDATE:
                    store.users.forEach(user => {
                        if (user.id === payload.data.id)
                            applyPatch(user, {op: "replace", path: "", value: payload.data})
                    })
                    break
                case action.GET:
                    applyPatch(store, {op: 'replace', path: '/users', value: payload.data})
                    break
                default:
                    break
            }
        })
        sio.on(channel.DIALOG, payload => {
            const dialog = store.getDialog(payload.data.dialogId)
            switch (payload.action) {
                case action.UPDATE: // STATIC
                    if (payload.data.message.lastMessageSenderId !== store.id) {  // отправленное собеседником
                        dialog.incUnreadMessages()
                        notice.play()
                    }
                    dialog.incTotalMessages()
                    dialog.setLastMessageSenderId(payload.data.message.lastMessageSenderId)
                    dialog.setLastMessageText(payload.data.message.lastMessageText)
                    dialog.setLastMessageTime(payload.data.message.lastMessageTime)
                    break
                case action.GET: // DYNAMIC
                    // TODO: lazy load message applyPatch(dialog, {op: 'add', path: '/messages/-', value: payload.data.messages})
                    applyPatch(dialog, {op: 'replace', path: '/messages', value: payload.data.messages})
                    applyPatch(store, {op: 'replace', path: '/joinedDialog', value: dialog})
                    break
                case action.WRITE:  // DYNAMIC
                    notice.play()
                    if (payload.data.message.senderId === store.id) {  // отправленное собой
                        const selfMessage = dialog.messages.find(msg => msg.text === payload.data.message.text && msg.sent)
                        applyPatch(store, {op: 'replace', path: getPath(selfMessage), value: payload.data.message})
                    } else {  // отправленное собеседником
                        dialog.addMessage(payload.data.message)
                    }
                    break
                case action.READ: // DYNAMIC
                    payload.data.messageIds.forEach(msgId => dialog.messages.find(msg => msg.id === msgId).setRead())
                    dialog.resetUnreadMessages()
                    break
                default:
                    break
            }
        })

    })
}
const chatStore = (store) => {
    receive(store)
    send(store)
    connected(store)
}
export default chatStore