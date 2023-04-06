import React from "react"
import {List, ListItemSecondaryAction, ListItemText} from "@mui/material"
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
import Typography from "@mui/material/Typography"
import StatusIcon from "../components/StatusIcon"
import StatusListItemAvatar from "../components/StatusListItemAvatar"

const DialogsView = ({dialogs, children}) => {
    const navigate = useNavigate()
    const {dialogId} = useParams()
    const statusConnected = (isConnected, lastVisit) => isConnected ? 'Online' : `Был: ${moment.utc(lastVisit).tz(timezone).startOf("day").format('DD.MM.YYYY')}`
    return <Box sx={theme => ({
        height: '100%',
        position: 'relative',
        width: isMobile ? '100%' : 400,
        backgroundColor: '#fff',
        borderRight: `${isMobile ? 0 : 1}px solid ${theme.palette.grey[300]}`,
        overflow: 'auto'
    })}>
        <List
            sx={{
                pt: 0,
                pb: 0
        }}
        >
            {dialogs.map((dialog) =>
                <ListItemButton
                    sx={{
                        maxHeight: 56
                    }}
                    key={dialog.id}
                    divider
                    dense
                    selected={parseInt(dialogId) === dialog.id}
                    onClick={() => navigate(routes.chat + '/' + dialog.id)}
                >
                    <StatusListItemAvatar
                        title={dialog.name[0].toUpperCase()}
                        unreadMessages={dialog.unreadMessages}
                        // image={Robot}
                    />
                    <ListItemText
                        primary={dialog.name === 'support' ? "Чат поддержки" : dialog.name}
                        primaryTypographyProps={{
                            fontWeight: 'bold',
                            align: 'left',
                            noWrap: true,
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
                                    {dialog?.sender.isConnected ? "Online" : statusConnected(dialog.sender.isConnected, dialog.sender.lastVisit)}
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