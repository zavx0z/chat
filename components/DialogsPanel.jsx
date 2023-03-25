import React, {useEffect} from "react"
import {List, ListItemAvatar, ListItemSecondaryAction, ListItemText, TextField} from "@mui/material"
import ListItemButton from "@mui/material/ListItemButton"
import {useNavigate, useParams} from "react-router-dom"
import routes from "../../../routes/routes"
import {observer} from "mobx-react"
import {StatusAvatar} from "./StatusAvatar"
import {StatisticsUserList} from "./StatisticsUserList"
import moment from "moment-timezone"
import {timezone} from "../utils/date"


const DialogsPanel = ({dialogs, dialogJoin, dialogLeave}) => {
    const navigate = useNavigate()
    const {dialogId} = useParams()
    useEffect(() => {
        dialogId && dialogJoin(dialogId)
        return () => dialogLeave(dialogId)
    }, [dialogId, dialogLeave, dialogJoin])
    const statusConnected = (isConnected, lastVisit) => {
        return isConnected ? 'Online' : `Был: ${moment.utc(lastVisit).tz(timezone).startOf("day").format('DD.MM.YYYY')}`
    }
    return <>
        <TextField
            fullWidth
            size={'small'}
            variant={'outlined'}
            placeholder={'поиск'}
        />
        <List sx={{pt: 0}}>
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
                            username={dialog.username[0]}
                            isMobile={dialog.owner.isMobile}
                            isConnected={dialog.owner.isConnected}
                            deviceModel={dialog.owner.deviceModel}
                        />
                    </ListItemAvatar>
                    <ListItemText
                        primary={dialog.owner.name}
                        primaryTypographyProps={{
                            fontWeight: 'bold',
                        }}
                        secondary={dialog.lastMessage}
                        secondaryTypographyProps={{
                            noWrap: true,
                            sx: {maxWidth: !!dialog.unreadMessages ? '90%' : '100%'}
                        }}
                    >
                    </ListItemText>
                    <ListItemSecondaryAction sx={{
                        flexGrow: 1,
                        height: "100%",
                        pt: 2,
                    }}>
                        <StatisticsUserList
                            lastSentDate={dialog.lastSentDate}
                            unreadMessages={dialog.unreadMessages}
                            status={statusConnected(dialog.owner.isConnected, dialog.owner.lastVisit)}
                        />
                    </ListItemSecondaryAction>
                </ListItemButton>)}
        </List>
    </>
}
export default observer(DialogsPanel)