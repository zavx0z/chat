import {Computer, NetworkLocked, PhoneAndroid, PhoneIphone} from "@mui/icons-material"
import {useEffect, useMemo, useState} from "react"
import {observer} from "mobx-react"

const StatusIcon = ({isConnected, isMobile, deviceModel}) => {
    const [online, setOnline] = useState(navigator.onLine)
    useEffect(() => {
        const setOnLine = () => setOnline(true)
        const setOffline = () => setOnline(false)
        window.addEventListener('offline', setOffline)
        window.addEventListener('online', setOnLine)
        return () => {
            window.removeEventListener('online', setOnLine)
            window.removeEventListener('offline', setOffline)
        }
    }, [setOnline])

    const color = useMemo(() => isConnected ? "info" : 'error', [isConnected])
    useEffect(() => {
        console.log(navigator.onLine)
    }, [navigator.onLine])
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