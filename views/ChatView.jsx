import React from 'react'
import Box from "@mui/material/Box"
import {Route, Routes} from "react-router-dom"
import {inject, observer} from "mobx-react"
import DialogView from "./DialogView"
import Notice from "../controllers/Notice"

const main = {
    width: '100%',
    display: 'flex',
    overflow: 'hidden',
}
const ChatView = ({everything: {id}}) =>
    <Box sx={main}>
        <Notice/>
        <Routes>
            <Route path={":dialogId"} element={<DialogView userId={id}/>}/>
        </Routes>
    </Box>
export default inject('everything')(observer(ChatView))