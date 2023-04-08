import ListItemButton from "@mui/material/ListItemButton"
import routes from "../../../routes/routes"
import StatusListItemAvatar from "./StatusListItemAvatar"
import {ListItemSecondaryAction, ListItemText} from "@mui/material"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import StatusIcon from "./NetworkStatusIcon"
import React from "react"
import moment from "moment-timezone"
import {timezone} from "../utils/date"

const DialogListItem = ({selected, handleClick, dialogName, unreadMessages, lastMessage, isConnected, deviceModel, lastVisit}) => {
    const statusConnected = (isConnected, lastVisit) => isConnected ? 'Online' : `Был: ${moment.utc(lastVisit).tz(timezone).startOf("day").format('DD.MM.YYYY')}`
    return <ListItemButton
        sx={{
            maxHeight: 56
        }}
        divider
        dense
        selected={selected}
        onClick={handleClick}
    >
        <StatusListItemAvatar
            title={dialogName[0].toUpperCase()}
            unreadMessages={unreadMessages}
            // image={Robot}
        />
        <ListItemText
            primary={dialogName}
            primaryTypographyProps={{
                fontWeight: 'bold',
                align: 'left',
                noWrap: true,
            }}
            secondary={lastMessage}
            secondaryTypographyProps={{noWrap: true}}
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
                        color={isConnected ? "secondary.dark" : 'error'}
                        variant={"subtitle2"}
                    >
                        {isConnected ? "Online" : statusConnected(isConnected, lastVisit)}
                    </Typography>
                    <StatusIcon
                        isConnected={isConnected}
                        deviceModel={deviceModel}
                    />
                </Box>
            </Box>
        </ListItemSecondaryAction>
    </ListItemButton>
}
export default DialogListItem