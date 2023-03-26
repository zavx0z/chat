import Avatar from "@mui/material/Avatar"
import {Computer, PhoneAndroid, PhoneIphone} from "@mui/icons-material"
import React, {useMemo} from "react"
import Box from "@mui/material/Box"

export const StatusAvatar = ({username, isMobile, isConnected, deviceModel}) => {
    const style = useMemo(() => ({
        position: "absolute",
        bottom: -4,
        right: 10,
        color: isConnected ? "secondary.dark" : 'gray.100',
    }), [isConnected])
    return <Box sx={{display: "flex", position: 'relative'}}>
        <Avatar>
            {username[0]}
        </Avatar>
        {isMobile ?
            deviceModel == 'iPhone' ? <PhoneIphone fontSize={'small'} sx={style}/> : <PhoneAndroid fontSize={'small'} sx={style}/> :
            <Computer fontSize={'small'} sx={style}/>
        }
    </Box>
}