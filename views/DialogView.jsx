import InputMessage from "../components/InputMessage"
import React, {useEffect, useState} from "react"
import Chat from "../containers/Chat"
import {observer} from "mobx-react"
import useViewportHeight from "../../../layouts/hooks/useViewportHeight"


const DialogView = ({userId, dialog}) => {
    const [scrolling, setScrolling] = useState('auto')

    const {isKeyboardOpen} = useViewportHeight()
    useEffect(() => {
        isKeyboardOpen && setTimeout(() => setScrolling('smooth'), 0)
    }, [isKeyboardOpen, setScrolling])


    return dialog && userId && <>
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
    </>
}
export default observer(DialogView)