import {Chip, ListItem, ListSubheader} from "@mui/material"
import Message from "./Message"
import {observer} from "mobx-react"

const MessageList = ({messages, userId, sticked}) => {

    return Object.keys(messages)
        .map((date, idx) => (
            <li key={`section-${idx}`}
                style={{
                    width: "100%",
                }}
            >
                <ul style={{
                    listStyleType: 'none',
                    margin: 0,
                    padding: 0,
                    width: "100%",
                }}>
                    <ListSubheader disableSticky={sticked} disableGutters sx={{
                        bgcolor: "transparent",
                        display: "flex",
                        justifyContent: "center",
                        mb: 1,
                    }}>
                        <Chip label={date} variant="filled" size={'small'}/>
                    </ListSubheader>
                    {messages[date].map(({id, text, time, senderName, senderId, status}) => (
                        <ListItem
                            disablePadding
                            disableGutters
                            dense
                            key={`item-${id}`}
                        >
                            <Message
                                key={id}
                                author={senderName}
                                content={text}
                                isSentByMe={senderId === userId}
                                sentTime={time}
                                status={status}
                            />
                        </ListItem>
                    ))}
                </ul>
            </li>
        ))
}
export default observer(MessageList)