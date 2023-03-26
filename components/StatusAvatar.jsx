import Avatar from "@mui/material/Avatar"
import {Computer, PhoneAndroid, PhoneIphone} from "@mui/icons-material"
import React, {useMemo} from "react"
import Box from "@mui/material/Box"
import {observer} from "mobx-react"

const StatusAvatar = ({name, isMobile, isConnected, deviceModel}) => {
    const style = useMemo(() => ({
        position: "absolute",
        bottom: -4.444,
        right: .4444,
        color: isConnected ? "secondary.dark" : '#ff6c6c',
    }), [isConnected])
    return <Box sx={{
        display: "flex",
        position: 'relative',
        width: 58
    }}>
        <Avatar>
            {!!name && name[0]}
        </Avatar>
        {typeof isMobile !== "undefined" && deviceModel ?
            deviceModel === 'iPhone' ? <PhoneIphone fontSize={'small'} sx={style}/> : <PhoneAndroid fontSize={'small'} sx={style}/> :
            <Computer fontSize={'small'} sx={style}/>
        }
    </Box>
}
export default observer(StatusAvatar)