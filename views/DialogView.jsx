import InputMessage from "../components/InputMessage"
import React, {useEffect, useState} from "react"
import Chat from "../containers/Chat"
import {inject, observer} from "mobx-react"
import useViewportHeight from "../../layout/hooks/useViewportHeight"
import Box from "@mui/material/Box"
import {useParams} from "react-router-dom"

const chatBlockStyles = {
    width: '100%',
    height: '100%',
    display: "flex",
    flexDirection: 'column',
    overflow: 'hidden',
}

const DialogView = ({userId, root: {dialogJoin, dialogLeave}}) => {
    const {dialogId} = useParams()
    const [dialog, setDialog] = useState(null)

    useEffect(() => {
        dialogJoin(dialogId).then(setDialog)
        return () => dialogLeave(dialogId)
    }, [dialogId, dialogJoin, dialogLeave])

    const [scrolling, setScrolling] = useState('auto')
    const {isKeyboardOpen} = useViewportHeight()
    useEffect(() => {
        isKeyboardOpen && setTimeout(() => setScrolling('smooth'), 0)
    }, [isKeyboardOpen, setScrolling])

    return dialog && <Box sx={chatBlockStyles}>
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
export default inject('root')(observer(DialogView))