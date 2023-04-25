import {sioAfterConnect, sioAfterCreate, sioMiddleware} from "../sio/sioMiddleware"
import {applyPatch, getPath} from "mobx-state-tree"
import channel from "./channels"
import action from "./action"
import {notice} from "./controllers/Notice"

const connected = store => sioAfterConnect(store, (sio, store) => {
    sio.emit(channel.CHAT, {}, (response) => {
        applyPatch(store, {op: 'replace', path: '/dialogs', value: response})
        store.setLoadingDialogs(false)
    })
})

const send = store => sioMiddleware(store, [
    {
        model: 'root',
        action: 'dialogJoin',
        after: ({sio, result}) => result
            .then(dialog => sio.emit(
                channel.DIALOG, {action: action.JOIN, data: {dialogId: dialog.id}},
                messages => applyPatch(dialog, {op: 'replace', path: '/messages', value: messages})
            ))
    },
    {
        model: 'root',
        action: 'dialogLeave',
        after: ({sio, result}) => result &&
            sio.emit(channel.DIALOG, {action: action.LEAVE, data: {dialogId: result.id}})
    },
    {
        model: 'dialog',
        action: 'sendMessage',
        after: ({sio, result, instance}) => {
            sio.emit(channel.DIALOG,
                {action: action.WRITE, data: {dialogId: instance.id, text: result.text}},
                msg => applyPatch(store, {op: 'replace', path: getPath(result), value: msg})
            )
        }
    },
    {
        model: 'dialog',
        action: 'readMessage',
        after: ({sio, result, instance}) => result &&
            sio.emit(channel.DIALOG, {action: action.READ, data: {dialogId: parseInt(instance.id), messageIds: result}})
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
                case action.WRITE:  // DYNAMIC
                    dialog.addMessage(payload.data.message)
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
const dialogsStore = (store) => {
    receive(store)
    send(store)
    connected(store)
}
export default dialogsStore