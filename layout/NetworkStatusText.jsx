import isOnline from "../hooks/IsOnline"
import * as React from "react"
import {useMemo} from "react"
import Typography from "@mui/material/Typography"

const NetworkStatusText = ({isConnected}) => {
    const online = isOnline()
    const text = useMemo(() => {
        if (!online)
            return 'нет сети'
        else if (isConnected)
            return 'Online'
        else return 'Offline'
    }, [online, isConnected])

    const color = useMemo(() => {
        if (!online)
            return 'grey.300'
        else if (isConnected)
            return "info.main"
        else if (online && !isConnected)
            return "grey.600"
    }, [online, isConnected])
    return <Typography
        color={color}
        variant={"subtitle2"}
        pr={.44}
    >
        {text}
    </Typography>
}
export default NetworkStatusText