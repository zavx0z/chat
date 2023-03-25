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