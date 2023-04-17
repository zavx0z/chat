import ListItemButton from "@mui/material/ListItemButton"
import StatusListItemAvatar from "./StatusListItemAvatar"
import {ListItemSecondaryAction, ListItemText} from "@mui/material"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import StatusIcon from "./NetworkStatusIcon"
import React from "react"
import moment from "moment-timezone"
import {timezone} from "../utils/date"

const DialogListItem = ({selected, handleClick, dialogTitle, unreadMessages, lastMessage, isConnected, deviceModel, lastVisit}) => {
    const statusConnected = (isConnected, lastVisit) => isConnected ? 'Online' : `Был: ${moment.utc(lastVisit).tz(timezone).startOf("day").format('DD.MM.YYYY')}`
    return <ListItemButton
        sx={theme=>({
            maxHeight: theme.spacing(7),
            minHeight: theme.spacing(7),
        })}
        dense
        selected={selected}
        onClick={handleClick}
    >
        <StatusListItemAvatar
            title={dialogTitle[0].toUpperCase()}
            unreadMessages={unreadMessages}
            // image={Robot}
        />
        <ListItemText
            primary={dialogTitle}
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