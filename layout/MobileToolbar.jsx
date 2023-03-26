import {IconButton} from "@mui/material"
import MuiToolbar from "@mui/material/Toolbar"
import routes from "../../../routes/routes"
import {ArrowBackIosNew} from "@mui/icons-material"
import StatusAvatar from "../components/StatusAvatar"
import Typography from "@mui/material/Typography"
import ToolBar from "../../../layouts/ToolBar"
import * as React from "react"
import {useEffect} from "react"
import {inject, observer} from "mobx-react"
import {useNavigate, useParams} from "react-router-dom"

const MobileToolbar = ({user: {joinedDialog, dialogLeave, dialogJoin}}) => {
    const navigate = useNavigate()
    const {dialogId} = useParams()
    useEffect(() => {
        dialogId && dialogJoin(dialogId)
        return () => dialogLeave(dialogId)
    }, [dialogId, dialogLeave, dialogJoin])
    return !!joinedDialog ?
        <MuiToolbar sx={{
            display: 'flex',
            flexGrow: 1,
            justifyContent: 'space-between',
        }}>
            <IconButton
                sx={{display: 'flex', mr: 1, ml: -1}}
                color={'secondary'}
                onClick={() => navigate(routes.chat)}
            >
                <ArrowBackIosNew sx={{color: 'white'}}/>
            </IconButton>
            <StatusAvatar
                name={joinedDialog.name[0]}
                isMobile={joinedDialog.sender.isMobile}
                isConnected={joinedDialog.sender.isConnected}
                deviceModel={joinedDialog.sender.deviceModel}
            />
            <Typography
                sx={{
                    display: 'flex',
                    flexGrow: 1,
                    pl: 1
                }}>
                {joinedDialog.name}
            </Typography>
            {!joinedDialog.sender.isConnected &&
                <Typography variant={'caption'}>
                    Был: {joinedDialog.lastSentDate}
                </Typography>
            }
        </MuiToolbar>
        :
        <ToolBar/>

}
export default inject('user')(observer(MobileToolbar))