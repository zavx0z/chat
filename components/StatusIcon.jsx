import {Computer, PhoneAndroid, PhoneIphone} from "@mui/icons-material"
import {useEffect, useMemo} from "react"
import {observer} from "mobx-react"

const StatusIcon = ({isConnected, isMobile, deviceModel}) => {
    const color = useMemo(() => isConnected ? "info" : 'error', [isConnected])
    useEffect(() => {
        console.log('isMobile', isMobile)
        console.log('deviceModel', deviceModel)
    }, [isMobile])
    return isMobile && deviceModel ?
        deviceModel === 'iPhone' ?
            <PhoneIphone fontSize={'small'} color={color}/>
            : <PhoneAndroid color={color} fontSize={'small'}/> :
        <Computer color={color} fontSize={'small'}/>
}
export default observer(StatusIcon)