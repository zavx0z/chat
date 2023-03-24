import {getRoot, types} from "mobx-state-tree"
import moment from "moment-timezone"
import {timezone} from "../utils/date"

export const messageModel = types
    .model('message', {
        id: types.identifierNumber,
        text: types.string,
        senderId: types.integer,
        created: types.string,
        read: types.boolean,
        sent: types.maybe(types.boolean)
    })
    .views(self => ({
        get time() {
            return moment.utc(self['created']).tz(timezone).format('HH:mm')
        },
        get senderName() {
            const {username, users} = getRoot(self)
            if (this.isSentByMe)
                return username
            else if (!users.length)
                return 'Admin'
            else
                return users.find(user => user.id === self['senderId']).name
        },
        get isSentByMe() {
            return self['senderId'] === getRoot(self)['id']
        },
        get status() {
            if (!self['isSentByMe'])
                return null
            else if (self['sent'])
                return "SENDING"
            else if (self['read'])
                return "READING"
            else
                return "WAITING"
        }
    }))