import {types} from 'mobx-state-tree'
import {Dialog} from "./dialogModel"
import {UsersModel} from "./usersModel"

const chatModel = types
    .model({
        dialogs: types.array(Dialog),
        users: types.array(UsersModel),
        joinedDialog: types.safeReference(Dialog),
    })
    .volatile(self => ({
        sio: undefined,
    }))
    .actions(self => ({
        getDialog(dialog) {
            const {dialogs} = self
            if (parseInt(dialog))
                return dialogs.find(item => item.id === parseInt(dialog))
            else if (typeof dialog == 'string' && dialog.length > 0)
                return dialogs.find(item => item.name === dialog)
        },
        dialogJoin(dialog) {
            const d = this.getDialog(dialog)
            console.log(self.dialogs.length, d)
            return d
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