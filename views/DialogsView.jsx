import React from "react"
import {Chip, List, ListItemAvatar, ListItemSecondaryAction, ListItemText} from "@mui/material"
import ListItemButton from "@mui/material/ListItemButton"
import {useNavigate, useParams} from "react-router-dom"
import routes from "../../../routes/routes"
import {observer} from "mobx-react"
import moment from "moment-timezone"
import {timezone} from "../utils/date"
import Box from "@mui/material/Box"
import {isMobile} from "react-device-detect"
import {getRoot} from "mobx-state-tree"
import Divider from "@mui/material/Divider"
import Avatar from "@mui/material/Avatar"
import {DoneAll} from "@mui/icons-material"
import Typography from "@mui/material/Typography"
import StatusIcon from "../components/StatusIcon"

const Status = ({countUnreadMessages}) => {
    return !!countUnreadMessages ? <Chip
            sx={{
                position: "absolute",
                bottom: -5,
                right: 4
            }}
            size={'small'}
            color={'info'}
            label={countUnreadMessages}
        />
        :
        <DoneAll
            sx={{
                color: "secondary.dark",
                position: "absolute",
                bottom: -5,
                right: 10
            }}
            fontSize={'small'}
        />
}

const DialogsView = ({dialogs, children}) => {
    const navigate = useNavigate()
    const {dialogId} = useParams()
    const statusConnected = (isConnected, lastVisit) => {
        return isConnected ? 'Online' : `Был: ${moment.utc(lastVisit).tz(timezone).startOf("day").format('DD.MM.YYYY')}`
    }
    return <Box sx={{
        height: '100%',
        position: 'relative',
        backgroundColor: '#fff',
        overflow: 'auto',
        ...isMobile ? {width: '100%'} : {minWidth: 300, maxWidth: 400, borderRight: "1px solid #D5D5D5FF",}
    }}>
        <List sx={{pt: 1, pb: 0}}>
            {dialogs.map((dialog) =>
                <ListItemButton
                    key={dialog.id}
                    divider
                    dense
                    selected={parseInt(dialogId) === dialog.id}
                    onClick={() => navigate(routes.chat + '/' + dialog.id)}
                >
                    <ListItemAvatar sx={{position: 'relative'}}>
                        <Avatar>
                            {dialog.name[0].toUpperCase()}
                        </Avatar>
                        <Status countUnreadMessages={dialog.unreadMessages}/>
                    </ListItemAvatar>
                    <ListItemText
                        primary={dialog.sender.name}
                        primaryTypographyProps={{
                            fontWeight: 'bold',
                            align: 'left',
                        }}
                        secondary={dialog.lastMessageSenderId === getRoot(dialog).id ?
                            "Вы: " + dialog.lastMessage :
                            dialog.lastMessage
                        }
                        secondaryTypographyProps={{
                            noWrap: true,
                        }}
                    >
                    </ListItemText>
                    <ListItemSecondaryAction sx={{
                        flexGrow: 1,
                        height: "100%",
                        pt: 2.2,
                    }}>
                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyItems: 'flex-start',
                            justifyContent: 'flex-end',
                            flexWrap: 'wrap',
                        }}>
                            <Box sx={{display: 'flex', gap: 1}}>
                                <Typography
                                    color={dialog.sender.isConnected ? "secondary.dark" : 'error'}
                                    variant={"subtitle2"}
                                >
                                    {dialog.sender.isConnected ? "Online" : statusConnected(dialog.sender.isConnected, dialog.sender.lastVisit)}
                                </Typography>
                                <StatusIcon
                                    isConnected={dialog.sender.isConnected}
                                    isMobile={dialog.sender.isConnected}
                                    deviceModel={dialog.sender.deviceModel}
                                />
                            </Box>
                        </Box>
                    </ListItemSecondaryAction>
                </ListItemButton>)}
        </List>
        {children}
        <Divider/>
    </Box>
}
export default observer(DialogsView)