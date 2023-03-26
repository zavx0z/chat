import {TextField} from "@mui/material"
import React from "react"

export const NewDialogButton = () => {
    return <TextField
        fullWidth
        size={'small'}
        variant={'outlined'}
        placeholder={'поиск'}
    />
}