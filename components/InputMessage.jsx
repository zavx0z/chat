import Box from "@mui/material/Box"
import {Fade, FilledInput, IconButton} from "@mui/material"
import {Telegram} from "@mui/icons-material"
import React, {useRef, useState} from "react"
import InputAdornment from "@mui/material/InputAdornment"
import {isBrowser} from "react-device-detect"

const InputMessage = ({sendMessage, readMessage, setScrolling}) => {
    const inputRef = useRef(null)
    const [message, setMessage] = useState('')
    const handleMessageChange = (event) => setMessage(event.target.value)
    const handleSendMessage = () => {
        if (message.length) {
            sendMessage(message)
            setMessage('')
            setScrolling('smooth')
            inputRef.current.focus()
        }
    }
    const handleKeyPress = (e) => {
        if ((e.keyCode === 13 && e.ctrlKey)) {
            setMessage(message + '\n')
            setScrolling('smooth')
        } else if (e.keyCode === 13 && e.shiftKey) {
        } else if (isBrowser && e.key === 'Enter') {
            e.preventDefault()
            handleSendMessage()
        }
    }
    const isMultiline = message.search('\n') > 0
    return <Box sx={{
        display: 'flex'
    }}>
        <FilledInput
            sx={isMultiline ? {alignItems: "end"} : {}}
            inputRef={inputRef}
            placeholder={"Написать сообщение..."}
            fullWidth
            multiline
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyPress}
            autoComplete={'off'}
            disableUnderline
            hiddenLabel
            onFocus={readMessage}
            endAdornment={
                <InputAdornment position="end">
                    <Fade in={!!message.length}>
                        <div style={{display: "flex"}}>
                            <IconButton
                                sx={{pb: isMultiline ? 4 : 0}}
                                variant="contained"
                                color="primary"
                                onClick={handleSendMessage}
                                edge="end"
                            >
                                <Telegram color={"action"} fontSize={'large'}/>
                            </IconButton>
                        </div>
                    </Fade>
                </InputAdornment>
            }
        />
    </Box>
}
export default InputMessage