import {types} from 'mobx-state-tree'
import {Dialog} from "./dialogModel"
import {UsersModel} from "./usersModel"

const LOGS_LENGTH = 100

const chatModel = types
    .model({
        dialogs: types.array(Dialog),
        users: types.array(UsersModel),
        joinedDialog: types.safeReference(Dialog),
        logs: types.array(types.string)
    })
    .volatile(self => ({
        sio: undefined,
    }))
    .actions(self => ({
        addLog(payload) {
            const {logs} = self
            logs.unshift(payload)
            if (logs.length > LOGS_LENGTH)
                logs.splice(LOGS_LENGTH, logs.length - LOGS_LENGTH)
        },
        getDialog(dialog) {
            const {dialogs} = self
            if (parseInt(dialog))
                return dialogs.find(item => item.id === parseInt(dialog))
            else if (typeof dialog == 'string' && dialog.length > 0)
                return dialogs.find(item => item.name === dialog)
        },
        dialogJoin(dialog) {
            return this.getDialog(dialog)
        },
        dialogLeave(dialog) {
            return this.getDialog(dialog)
        }
    }))
    .views(self => ({
        get unreadMessages() {
            let count = 0
            if (self.dialogs) {
                self.dialogs.forEach(dialog => count += dialog.unreadMessages)
                return count
            } else return 0
        },
        get logString() {
            return self.logs.length ? self.logs.join('\n') : '>>>'
        }
    }))

export default chatModel