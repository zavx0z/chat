import {sioAfterCreate, sioMiddleware} from "../../middleware/sioMiddleware"
import {applyPatch} from "mobx-state-tree"
import channel from "./channels"
import action from "./actions/action"
import {dialogJoin, dialogRead, dialogWrite} from "./actions/dialogActions"


const receive = (store) => sioAfterCreate(store, (sio, store) => {
    sio.on(channel.CHAT, payload => {
        switch (payload.action) {
            case 'init':
                sio.emit(channel.USERS, {
                    action: action.GET,
                    data: payload.data.map(({id}) => id)
                })
                applyPatch(store, {
                    op: 'replace',
                    path: '/dialogs',
                    value: payload.data
                })
                break
            default:
                break
        }
    })
    sio.on(channel.DIALOG, payload => {
        const dialog = store.getDialog(payload.data.dialogId)
        switch (payload.action) {
            case action.JOIN:
                dialogJoin(store, dialog, payload.data)
                break
            case action.LEAVE:
                break
            case action.UPDATE:
                break
            case action.WRITE:
                dialogWrite(store, dialog, payload.data)
                break
            case action.READ:
                dialogRead(store, dialog, payload.data)
                break
            default:
                break
        }
    })
    // console.log(sio.listeners(CHANNEL_DIALOG).length)
    sio.on(channel.MESSAGE, data => store.getDialog(data.dialogId).addMessage(data.message))
    sio.on(channel.USERS, data => applyPatch(store, {op: 'replace', path: '/users', value: data}))
    sio.emit(channel.CHAT, {action: 'init'})
})
const send = (store) => sioMiddleware(store, [
    {
        model: 'user',
        action: 'dialogJoin',
        after: ({sio, args}) => sio.emit(channel.DIALOG, {action: action.JOIN, data: args.id})
    },
    {
        model: 'user',
        action: 'dialogLeave',
        before: ({store}) => applyPatch(store, {op: 'replace', path: '/joinedDialog', value: undefined}),
        after: ({sio, args}) => args && sio.emit(channel.DIALOG, {action: action.LEAVE, data: args.id})
    },
    {
        model: 'dialog',
        action: 'sendMessage',
        before: ({sio, args, instance}) => args.length && sio.emit(channel.DIALOG, {action: action.WRITE, data: {dialogId: instance.id, text: args[0]}})
    },
    {
        model: 'dialog',
        action: 'readMessage',
        after: ({sio, args}) => args && sio.emit(channel.DIALOG, {action: action.READ, data: args})
    },
])
const chatStore = (store) => {
    receive(store)
    send(store)
}
export default chatStore