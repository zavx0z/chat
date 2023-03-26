import React from "react"
import {List, ListItemAvatar, ListItemSecondaryAction, ListItemText} from "@mui/material"
import ListItemButton from "@mui/material/ListItemButton"
import {useNavigate, useParams} from "react-router-dom"
import routes from "../../../routes/routes"
import {observer} from "mobx-react"
import StatusAvatar from "./StatusAvatar"
import {DialogStatistic} from "./DialogStatistic"
import moment from "moment-timezone"
import {timezone} from "../utils/date"
import Box from "@mui/material/Box"
import {isMobile} from "react-device-detect"
import {getRoot} from "mobx-state-tree"
import Button from "@mui/material/Button"
import Divider from "@mui/material/Divider"

const DialogsPanel = ({dialogs}) => {
    const navigate = useNavigate()
    const {dialogId} = useParams()
    const statusConnected = (isConnected, lastVisit) => {
        return isConnected ? 'Online' : `Был: ${moment.utc(lastVisit).tz(timezone).startOf("day").format('DD.MM.YYYY')}`
    }
    return <Box sx={{
        height: '100%',
        position: 'relative',
        width: isMobile ? '100%' : 400,
        backgroundColor: '#fff',
        borderRight: `${isMobile ? 0 : 1}px solid grey`,
        overflow: 'auto'
    }}>
        {/*<NewDialog/>*/}
        <List sx={{pt: 0, pb: 0}}>
            {dialogs.map((dialog) =>
                <ListItemButton
                    key={dialog.id}
                    divider
                    dense
                    selected={parseInt(dialogId) === dialog.id}
                    onClick={() => navigate(routes.chat + '/' + dialog.id)}
                >
                    <ListItemAvatar sx={{position: "relative"}}>
                        <StatusAvatar
                            name={dialog.name[0]}
                            isMobile={dialog.sender.isMobile}
                            isConnected={dialog.sender.isConnected}
                            deviceModel={dialog.sender.deviceModel}
                        />
                    </ListItemAvatar>
                    <ListItemText
                        primary={dialog.name.toUpperCase()}
                        primaryTypographyProps={{
                            fontWeight: 'bold',
                        }}
                        secondary={dialog.lastMessageSenderId === getRoot(dialog).id ?
                            "Вы: " + dialog.lastMessage :
                            dialog.lastMessage
                        }
                        secondaryTypographyProps={{
                            noWrap: true,
                            sx: {pl: 1}
                        }}
                    >
                    </ListItemText>
                    <ListItemSecondaryAction sx={{
                        flexGrow: 1,
                        height: "100%",
                        pt: 2,
                    }}>
                        <DialogStatistic
                            lastSentDate={dialog.lastSentDate}
                            unreadMessages={dialog.unreadMessages}
                            status={statusConnected(dialog.sender.isConnected, dialog.sender.lastVisit)}
                        />
                    </ListItemSecondaryAction>
                </ListItemButton>)}
        </List>
        <Box sx={{p: 1}}>
            <Button
                fullWidth
                color={"inherit"}
                variant={'contained'}
                size={'small'}
            >
                Создать проект
            </Button>
        </Box>
        <Divider/>
    </Box>
}
export default observer(DialogsPanel)