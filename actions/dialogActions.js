import {applyPatch, getPath} from "mobx-state-tree"
import {updateInstance} from "../utils/mst"

export const dialogJoin = (store, dialog, data) => {
    applyPatch(dialog, {
        op: 'replace',
        path: '/messages',
        value: data.messages
    })
    applyPatch(store, {
        op: 'replace',
        path: '/joinedDialog',
        value: dialog
    })
}
export const dialogWrite = (store, dialog, data) => {
    if (data.message.senderId === store.id) {
        const selfMessage = dialog.messages.find(msg => msg.text === data.message.text && msg.sent)
        applyPatch(store, {
            op: 'replace',
            path: getPath(selfMessage),
            value: data.message
        })
    } else {
        dialog.addMessage(data.message)
        applyPatch(dialog, {
            op: 'replace',
            path: '/unreadMessages',
            value: dialog.unreadMessages + 1
        })
    }
    updateInstance(dialog, {
        totalMessages: dialog.totalMessages + 1,
        lastMessageText: data.message.text,
        lastMessageTime: data.message.created,
        lastMessageSenderId: data.message.senderId,
    })
}
export const dialogRead = (store, dialog, data) => {
    data.messageIds.forEach(msgId => {
        const message = dialog.messages.find(msg => msg.id === msgId)
        applyPatch(message, {
            op: 'replace',
            path: '/read',
            value: true
        })
    })
    applyPatch(dialog, {op: 'replace', path: '/unreadMessages', value: 0})
}