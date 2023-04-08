import React, {useCallback, useEffect, useRef, useState} from "react"
import {observer} from "mobx-react"
import {Chip, Fab, Slide} from "@mui/material"
import List from "@mui/material/List"
import Box from "@mui/material/Box"
import MessageList from "../components/MessageList"
import {useGesture} from "@use-gesture/react"
import {ExpandMore} from "@mui/icons-material"
import {scrollBottom} from "../utils/position"
import Notice from "../controllers/Notice"

let timeoutId

const Chat = ({userId, messages, readMessage, unreadMessages, scrolling, setScrolling}) => {
    const listRef = useRef(null)
    const scrollDown = useCallback((behavior = 'auto') => {
        const container = listRef.current
        container.scrollTo({top: container.scrollHeight - container.clientHeight, behavior: behavior})
    }, [listRef])
    useEffect(() => {
        if (scrolling) {
            setScrolling(null)
            scrollDown(typeof scrolling === "string" && scrolling)
        }
    }, [scrolling, setScrolling, scrollDown])


    useEffect(() => {
        if (document.hasFocus() && unreadMessages < 2) {
            readMessage()
            setTimeout(() => scrollDown(), 4)
        }
    }, [readMessage, scrollDown, unreadMessages])

    const [isScrollDown, setIsScrollDown] = useState(false)
    const [isScrolled, setIsScrolled] = useState(false)
    const bind = useGesture({
        onScroll: ({xy: [x, y], target, delta: [dx, dy]}) => {
            setIsScrolled(true)
            clearTimeout(timeoutId)
            // для кнопки
            // console.log(target)
            const bottomPosition = scrollBottom(target)
            if (!bottomPosition)
                setIsScrollDown(false)
            else if (Math.abs(dy) > Math.abs(dx))
                setIsScrollDown(dy > 0 && bottomPosition > 400)

            timeoutId = setTimeout(() => {
                setIsScrolled(false)
                timeoutId = null
            }, 1000)
        }
    })
    const buttonScrollBottom = () => {
        scrollDown('smooth')
        readMessage()
    }
    return <Box sx={{
        width: '100%',
        position: "relative",
        display: "flex",
        overflowY: "inherit",
        flexGrow: 1,
        overflowX: "hidden",
    }}>
        <List
            {...bind()}
            onClick={readMessage}
            onTouchMove={e => e.stopPropagation()}
            sx={{
                overflowY: "auto",
                width: "100%",
                overflowX: "hidden",
                bgcolor: "background.paper",
                pt: 1,
            }}
            ref={listRef}
            dense
            disablePadding
            component="nav"
            aria-label="message list"
        >
            <MessageList userId={userId} messages={messages} sticked={!isScrolled}/>
        </List>
        <Slide in={isScrollDown || !!unreadMessages} direction={'up'}>
            <Fab
                onClick={buttonScrollBottom}
                sx={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12
                }}
                size="small"
                color="secondary"
                aria-label="add"
            >
                <ExpandMore/>
                {!!unreadMessages &&
                    <Chip sx={{
                        position: 'absolute',
                        top: -10,
                    }}
                          color="info"
                          size={'small'}
                          label={unreadMessages}
                    />}
            </Fab>
        </Slide>
        <Notice/>
    </Box>
}
export default observer(Chat)