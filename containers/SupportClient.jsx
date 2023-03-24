import React, {useEffect} from 'react'
import Box from "@mui/material/Box"
import {inject, observer} from "mobx-react"
import DialogView from "../views/DialogView"

const Supports = ({user: {id, dialogLeave, dialogJoin, joinedDialog, dialogs}}) => {
    useEffect(() => {
        dialogJoin("support")
        return () => dialogLeave("support")
    }, [dialogLeave, dialogJoin])

    return <Box sx={{
        display: "flex",
        flexGrow: 1,
        flexWrap: 'none',
        flexDirection: 'column',
        overflow: 'hidden',
        touchAction: 'none',
    }}>
        <DialogView userId={id} dialog={joinedDialog}/>
    </Box>
}
export default inject('user')(observer(Supports))