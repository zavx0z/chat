import * as React from "react"
import {useEffect, useState} from "react"
import NetworkStatusIcon from "../components/NetworkStatusIcon"
import {useParams} from "react-router-dom"
import {inject, observer} from "mobx-react"
import {Fade} from "@mui/material"
import Box from "@mui/material/Box"


const NetworkStatusCompanion = ({quantum: {waitDialog, waitUser}}) => {
    const [companion, setCompanion] = useState(null)
    const {dialogId} = useParams()
    useEffect(() => {
        waitDialog(dialogId).then(dialog => setCompanion(dialog.getCompanion()))
    }, [dialogId, waitDialog])
    return <Fade in={Boolean(companion)} mountOnEnter unmountOnExit>
        <Box sx={{display: 'flex'}}>
            <NetworkStatusIcon isConnected={companion?.isConnected} deviceModel={companion?.deviceModel}/>
        </Box>
    </Fade>
}
export default inject('quantum')(observer(NetworkStatusCompanion))