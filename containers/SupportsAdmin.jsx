import React, {useEffect} from 'react'
import Box from "@mui/material/Box"
import {Route, Routes} from "react-router-dom"
import {inject, observer} from "mobx-react"
import DialogView from "../views/DialogView"
import DialogsPanel from "../components/DialogsPanel"

const main = {
    height: '100vh',
    width: '100%',
    display: 'flex',
    overflow: 'hidden',
}
const leftPanel = {
    height: '100%',
    width: 400,
    backgroundColor: "#e5e4e4",
    overflow: 'auto'
}
const chatBlock = {
    width: '100%',
    height: '100%',
    display: "flex",
    flexDirection: 'column',
    overflow: 'hidden',
}
const SupportsAdmin = ({user: {id, dialogLeave, dialogJoin, joinedDialog, dialogs}}) => {
    const panel = <DialogsPanel dialogs={dialogs} dialogJoin={dialogJoin} dialogLeave={dialogLeave}/>
    useEffect(() => {
        console.log(joinedDialog?.messagesByDay)
    }, [joinedDialog])
    return <Box sx={main}>
        <Box sx={leftPanel}>
            <Routes>
                <Route path={'/'} element={panel}/>
                <Route path={':dialogId'} element={panel}/>
            </Routes>
        </Box>
        <Box sx={chatBlock}>
            <Routes>
                <Route path={":dialogId"} element={
                    <DialogView
                        userId={id}
                        dialog={joinedDialog}
                    />}/>
            </Routes>
        </Box>
    </Box>
}
export default inject('user')(observer(SupportsAdmin))