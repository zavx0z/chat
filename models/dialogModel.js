import {getRoot, types} from "mobx-state-tree"
import {messageModel} from "./messageModel"
import moment from "moment-timezone"
import {timezone} from "../utils/date"

const randomNegativeId = (min = -4444, max = -1) => -Math.floor(Math.random() * (max - min + 1)) + min

const dialogModel = types
    .model('dialog', {
        id: types.identifierNumber,
        name: types.string,
        ownerId: types.number,
        messages: types.array(messageModel),
        totalMessages: types.number,
        unreadMessages: types.number,
        lastMessageText: types.string,
        lastMessageTime: types.string,
        lastMessageSenderId: types.number,
        participants: types.array(types.integer)
    })
    .actions(self => ({
        incUnreadMessages() {
            self.unreadMessages = self.unreadMessages + 1
        },
        resetUnreadMessages() {
            self.unreadMessages = 0
        },
        incTotalMessages() {
            self.totalMessages = self.totalMessages + 1
        },
        setLastMessageText(text) {
            self.lastMessageText = text
        },
        setLastMessageTime(isoString) {
            self.lastMessageTime = isoString
        },
        setLastMessageSenderId(senderId) {
            self.lastMessageSenderId = senderId
        },
        addMessage(data) {
            self['messages'].push(messageModel.create(data))
        },
        sendMessage(text) {
            const message = messageModel.create({
                id: randomNegativeId(),
                text: text,
                senderId: getRoot(self)['id'],
                created: moment().toISOString(),
                read: false,
                sent: true
            })
            self['messages'].push(message)
            return message
        },
        readMessage() {
            if (self['unreadMessages']) {
                let unread = []
                self['messages'].forEach(message => {
                    if (!message.isSentByMe && !message.read)
                        unread.push(message.id)
                })
                return unread
            }
        },
        getOwnerUser() {
            const {users} = getRoot(self)
            return users.find(user => user.id === self['ownerId'])
        },
        getCompanion() {
            const {getUser, id} = getRoot(self)
            const {participants} = self
            if (participants.length === 2) {
                const companion = participants.find(item => item !== id)
                return getUser(companion)
            }
            return null
        }
    }))
    .views(self => ({
        get messagesByDay() {
            return !!self['messages'].length ?
                self['messages'].reduce((acc, message) => {
                    const date = moment.utc(message.created).tz(timezone).startOf("day").format('DD.MM.YYYY')
                    if (!acc[date])
                        acc[date] = []
                    acc[date].push(message)
                    return acc
                }, {})
                : []
        },
        get sender() {
            const {users, id} = getRoot(self)
            if (!self['ownerId'] || !users.length) return ''
            const sender = self.participants.find(item => item !== id)
            const sender_user = getRoot(self).users.find(user => user.id === sender)
            return sender_user
        },
        get lastMessage() {
            const senderName = self['lastMessageSenderId'] === getRoot(self)['id'] ? "Вы:" : ""
            return `${senderName} ${self['lastMessageText']}`
        },
        get lastSentDate() {
            return moment.utc(self['lastMessageTime']).tz(timezone).format('DD.MM HH:mm')
        },
        get title() {
            const {role} = getRoot(self)
            const {name, getOwnerUser} = self
            if (name === 'support' && (role === 'admin' || role === 'superuser'))
                return getOwnerUser().name
            else if (name === 'support')
                return "Чат поддержки"
            else
                return name
        }
    }))
export default dialogModel