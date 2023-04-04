import {Chip, ListItemAvatar} from "@mui/material"
import Avatar from "@mui/material/Avatar"
import {DoneAll} from "@mui/icons-material"
import React from "react"

const StatusListItemAvatar = ({title, unreadMessages, image}) =>
    <ListItemAvatar sx={{position: 'relative'}}>
        <Avatar
            src={image}
        >
            {title}
        </Avatar>
        {!!unreadMessages ?
            <Chip
                sx={{
                    position: "absolute",
                    bottom: -5,
                    right: 4
                }}
                size={'small'}
                color={'info'}
                label={unreadMessages}
            /> :
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
    </ListItemAvatar>
export default StatusListItemAvatar