import {Computer, NetworkLocked, PhoneAndroid, PhoneIphone} from "@mui/icons-material"
import {useMemo} from "react"
import {observer} from "mobx-react"
import IsOnline from "../hooks/IsOnline"

const NetworkStatusIcon = ({isConnected, deviceModel}) => {
    const online = IsOnline()
    const color = useMemo(() => isConnected ? "info" : 'error', [isConnected])
    if (deviceModel === 'iOS')
        return <PhoneIphone fontSize={'small'} color={color}/>
    else if (deviceModel === 'Android')
        return <PhoneAndroid color={color} fontSize={'small'}/>
    else if (deviceModel === 'Linux')
        return <Computer color={color} fontSize={'small'}/>
    else if (!online)
        return <NetworkLocked color={'warning'} fontSize={'small'}/>
    else return <></>
}
export default observer(NetworkStatusIcon)
