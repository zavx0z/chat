import * as React from "react"
import {useEffect, useState} from "react"
import Box from "@mui/material/Box"
import NetworkStatusText from "../components/NetworkStatusText"
import NetworkStatusIcon from "../components/NetworkStatusIcon"
import {useParams} from "react-router-dom"
import {inject, observer} from "mobx-react"

const NetworkStatusCompanion = ({root: {waitDialog, waitUser}}) => {
    const [companion, setCompanion] = useState(null)
    const {dialogId} = useParams()
    useEffect(() => {
        waitDialog(dialogId).then(dialog => setCompanion(dialog.getCompanion()))
    }, [dialogId, waitDialog])

    return companion && <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyItems: 'space-between',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
    }}>
        <Box sx={{display: 'flex', justifyContent: "flex-end"}}>
            <NetworkStatusText isConnected={companion.isConnected}/>
            <NetworkStatusIcon
                isConnected={companion.isConnected}
                deviceModel={companion.deviceModel}
            />
        </Box>
    </Box>
}
export default inject('root')(observer(NetworkStatusCompanion))