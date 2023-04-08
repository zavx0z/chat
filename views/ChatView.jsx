import React from 'react'
import Box from "@mui/material/Box"
import {Route, Routes} from "react-router-dom"
import {inject, observer} from "mobx-react"
import DialogView from "./DialogView"
import DialogsView from "./DialogList"
import {isBrowser} from "react-device-detect"

const main = {
    height: '100vh',
    width: '100%',
    display: 'flex',
    overflow: 'hidden',
}
const ChatView = ({user: {id, joinedDialog, dialogs}}) => {
    return <Box sx={main}>
        <Routes>
            <Route path={'/'} element={<>
                <DialogsView dialogs={dialogs}/>
            </>}/>
            <Route path={':dialogId'} element={isBrowser && <DialogsView dialogs={dialogs}/>}/>
        </Routes>
        <Routes>
            <Route path={":dialogId"} element={<DialogView userId={id} dialog={joinedDialog}/>}/>
        </Routes>
    </Box>
}
export default inject('user')(observer(ChatView))