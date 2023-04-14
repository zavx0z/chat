import {types} from 'mobx-state-tree'
import {Dialog} from "./dialogModel"

const chatModel = types
    .model({
        dialogs: types.array(Dialog),
    })
    .volatile(self => ({
        sio: undefined,
        loadingDialogs: true
    }))
    .actions(self => ({
        setLoadingDialogs(bool) {
            self.loadingDialogs = bool
        },
        getDialog(dialog) {
            const {dialogs} = self
            if (parseInt(dialog))
                return dialogs.find(item => item.id === parseInt(dialog))
            else if (typeof dialog == 'string' && dialog.length > 0)
                return dialogs.find(item => item.name === dialog)
        },
        getUser(userId) {
            return self.users.find(user => user.id === userId)
        },
        async waitDialog(dialogId) {
            const {loadingDialogs} = self
            if (loadingDialogs) {
                await new Promise((resolve) => {
                    const intervalId = setInterval(() => {
                        if (!self.loadingDialogs) {
                            clearInterval(intervalId)
                            resolve()
                        }
                    }, 100)
                })
            }
            return this.getDialog(dialogId)
        },
        async dialogJoin(dialogId) {
            return this.waitDialog(dialogId)
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
    }))

export default chatModel