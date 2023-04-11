import React from 'react'
import Box from "@mui/material/Box"
import {Route, Routes} from "react-router-dom"
import {inject, observer} from "mobx-react"
import DialogView from "./DialogView"
import DialogList from "./DialogList"
import {isBrowser} from "react-device-detect"
import Notice from "../controllers/Notice"
// import {sendTokenFCM} from "../../../firebase"

const main = {
    height: '100vh',
    width: '100%',
    display: 'flex',
    overflow: 'hidden',
}
const ChatView = ({user: {id, dialogs, loadingDialogs}}) => {
    // useEffect(() => {
    //     sendTokenFCM()
    // }, [])
    return <Box sx={main}>
        <Notice/>
        <Routes>
            <Route path={'/'} element={<DialogList loadingDialogs={loadingDialogs} dialogs={dialogs}/>}/>
            <Route path={':dialogId'} element={isBrowser && <DialogList loadingDialogs={loadingDialogs} dialogs={dialogs}/>}/>
        </Routes>
        <Routes>
            <Route path={":dialogId"} element={<DialogView userId={id}/>}/>
        </Routes>
    </Box>
}
export default inject('user')(observer(ChatView))