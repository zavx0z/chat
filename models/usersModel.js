import {types} from "mobx-state-tree"

export const UsersModel = types
    .model({
        id: types.identifierNumber,
        name: types.string,
        isMobile: types.boolean,
        lastVisit: types.string,
        isConnected: types.boolean,
        deviceModel: types.maybeNull(types.string)
    })
    .actions(self => ({
        setName(name) {
            console.log(name)
            self.name = name
        },
        setIsMobile(isMobile) {
            self.isMobile = isMobile
        },
        setLastVisit(lastVisit) {
            self.lastVisit = lastVisit
        },
        setIsConnected(isConnected) {
            self.isConnected = isConnected
        },
        setDeviceModel(deviceModel) {
            self.deviceModel = deviceModel
        }
    }))