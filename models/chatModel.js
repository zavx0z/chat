import {types} from 'mobx-state-tree'
import dialogModel from "./dialogModel"

const chatModel = types
    .model({
        dialogs: types.array(dialogModel),
    })
    .volatile(self => ({
        loadingDialogs: true
    }))
    .actions(self => ({
        setLoadingDialogs(bool) {
            console.log('dialogs', 'modeDialogs', bool ? 'Запрос - стартовал' : 'Запрос - окончен')
            self.loadingDialogs = bool
        },
        getDialog(idOrName) {
            const {dialogs} = self
            if (parseInt(idOrName))
                return dialogs.find(item => item.id === parseInt(idOrName))
            else if (typeof idOrName == 'string' && idOrName.length > 0)
                return dialogs.find(item => item.name === idOrName)
        },
        async waitDialog(id) {
            if (self.loadingDialogs || self['loadingUsers']) {
                console.log('dialogs', 'modelDialogs', 'Данные: Запрос')
                await new Promise((resolve) => {
                    const intervalId = setInterval(() => {
                        if (!self.loadingDialogs && !self['loadingUsers']) {
                            console.log('dialogs', 'modelDialogs', 'Данные: Получены')
                            clearInterval(intervalId)
                            resolve()
                        }
                    }, 100)
                })
            } else
                console.log('dialogs', 'modelDialogs', 'Данные: Присутствуют')
            return this.getDialog(id)
        },
        async dialogJoin(id) {
            console.log('dialogs', 'modelDialogs', 'Подписка на детальные обновления')
            return this.waitDialog(id)
        },
        dialogLeave(idOrName) {
            console.log('dialogs', 'modelDialogs', 'Отписка на детальные обновления')
            return this.getDialog(idOrName)
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