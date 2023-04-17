import InputMessage from "../components/InputMessage"
import React, {useEffect, useState} from "react"
import Chat from "../containers/Chat"
import {observer} from "mobx-react"
import useViewportHeight from "../../../layouts/hooks/useViewportHeight"
import Box from "@mui/material/Box"
import {useParams} from "react-router-dom"
import rootStore from "../../../stores/rootStore"

const DialogView = ({userId}) => {
    const {dialogId} = useParams()
    const [dialog, setDialog] = useState(null)
    useEffect(() => {
        console.log('dialogView')
        rootStore.dialogJoin(dialogId).then(setDialog)
        return () => rootStore.dialogLeave(dialogId)
    }, [dialogId])
    const [scrolling, setScrolling] = useState('auto')
    const {isKeyboardOpen} = useViewportHeight()
    useEffect(() => {
        isKeyboardOpen && setTimeout(() => setScrolling('smooth'), 0)
    }, [isKeyboardOpen, setScrolling])
    const chatBlock = {
        width: '100%',
        height: '100%',
        display: "flex",
        flexDirection: 'column',
        overflow: 'hidden',
    }
    return dialog && <Box sx={chatBlock}>
        <Chat
            userId={userId}
            scrolling={scrolling}
            setScrolling={setScrolling}
            messages={dialog.messagesByDay}
            readMessage={dialog.readMessage}
            unreadMessages={dialog.unreadMessages}
        />
        <InputMessage
            sendMessage={dialog.sendMessage}
            readMessage={dialog.readMessage}
            setScrolling={setScrolling}
        />
    </Box>
}
export default observer(DialogView)