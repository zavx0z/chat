import Avatar from "@mui/material/Avatar"
import {Chip} from "@mui/material"
import {DoneAll} from "@mui/icons-material"
import React from "react"
import Box from "@mui/material/Box"

const AvatarRead = ({name, unreadMessages}) =>
    <Box sx={{position: 'relative'}}>
        <Avatar>
            {name[0].toUpperCase()}
        </Avatar>
        {
            !!unreadMessages ?
                <Chip
                    sx={{
                        position: "absolute",
                        bottom: -4,
                        right: 7
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
    </Box>
export default AvatarRead