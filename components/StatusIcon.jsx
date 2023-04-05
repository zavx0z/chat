import {Computer, NetworkLocked, PhoneAndroid, PhoneIphone} from "@mui/icons-material"
import {useMemo} from "react"
import {observer} from "mobx-react"
import IsOnline from "../hooks/IsOnline"

const StatusIcon = ({isConnected, isMobile, deviceModel}) => {
    const online = IsOnline()
    const color = useMemo(() => isConnected ? "info" : 'error', [isConnected])
    const status = () => {
        if (!online)
            return <NetworkLocked color={'warning'} fontSize={'small'}/>
        else if (isMobile && deviceModel === 'iPhone')
            return <PhoneIphone fontSize={'small'} color={color}/>
        else if (isMobile && deviceModel === 'Android')
            return <PhoneAndroid color={color} fontSize={'small'}/>
        else if (deviceModel === 'Linux')
            return <Computer color={color} fontSize={'small'}/>
    }
    return status()

}
export default observer(StatusIcon)