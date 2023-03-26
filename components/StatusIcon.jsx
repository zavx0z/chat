import {Computer, PhoneAndroid, PhoneIphone} from "@mui/icons-material"
import {useMemo} from "react"

const StatusIcon = ({isConnected, isMobile, deviceModel}) => {
    const color = useMemo(() => isConnected ? "info" : 'error', [isConnected])
    return typeof isMobile !== "undefined" && deviceModel ?
        deviceModel === 'iPhone' ?
            <PhoneIphone fontSize={'small'} color={color}/>
            : <PhoneAndroid color={color} fontSize={'small'}/> :
        <Computer color={color} fontSize={'small'}/>
}
export default StatusIcon