import {Box, Typography} from '@mui/material'
import Avatar from "@mui/material/Avatar"
import {BrowserView, isMobile} from "react-device-detect"
import StatusMessage from "./StatusMessage"
import {observer} from "mobx-react"

const Message = ({author, content, isSentByMe, sentTime, status}) => {
    const avatarLetter = author.charAt(0).toUpperCase()
    const colorAvatar = (isSentByMe) => isSentByMe ? 'grey.600' : 'grey.400'
    const colorMessage = (isSentByMe) => isSentByMe ? 'grey.300' : 'grey.100'
    const position = (isSentByMe) => isMobile && isSentByMe && {flexDirection: 'row-reverse', textAlign: 'right'}
    return <Box sx={{
        width: "100%",
        display: 'flex',
        mb: 1,
        ml: 1,
        mr: 1,
        ...position(isSentByMe),
        position: 'relative'
    }}>
        <BrowserView>
            <Avatar sx={{
                width: 32,
                height: 32,
                mr: 2,
                ml: 2,
                bgcolor: colorAvatar(isSentByMe),
            }}>
                {avatarLetter}
            </Avatar>
        </BrowserView>
        <Box sx={{
            bgcolor: colorMessage(isSentByMe),
            borderRadius: 1,
            py: 1.5,
            px: 2,
            maxWidth: '75%',
            position: 'relative',
        }}>
            <Typography variant="body2" sx={{
                color: 'text.primary',
                fontWeight: 'bold',
                mb: 0.5,
            }}>
                {author} • {sentTime}
            </Typography>
            <Typography variant="body1" align={'left'} sx={{
                color: 'text.primary',
                whiteSpace: 'break-spaces',
                wordWrap: "break-word",
            }}>
                {content}
            </Typography>
            <StatusMessage status={status}/>
        </Box>
    </Box>
}

export default observer(Message)
