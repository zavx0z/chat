import {applyPatch} from "mobx-state-tree"

export const updateInstance = (model, obj) => {
    for (const prop in obj)
        applyPatch(model, {op: 'replace', path: `/${prop}`, value: obj[prop]})
}