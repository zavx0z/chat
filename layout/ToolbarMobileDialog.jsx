import {Fade, IconButton} from "@mui/material"
import MuiToolbar from "@mui/material/Toolbar"
import routes from "../../../routes/routes"
import {ArrowBackIosNew} from "@mui/icons-material"
import Typography from "@mui/material/Typography"
import * as React from "react"
import {useEffect, useMemo} from "react"
import {useNavigate, useParams} from "react-router-dom"
import Avatar from "@mui/material/Avatar"
import Box from "@mui/material/Box"
import StatusIcon from "../components/NetworkStatusIcon"
import {inject, observer} from "mobx-react"
import isOnline from "../hooks/IsOnline"

const StatusText = ({isConnected}) => {
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
    return <Typography color={color} variant={"subtitle2"} pr={.44}>
        {text}
    </Typography>
}

const ToolbarMobileDialog = ({user: {joinedDialog, dialogLeave, dialogJoin}}) => {
    const navigate = useNavigate()
    const {dialogId} = useParams()

    useEffect(() => {
        dialogId && dialogJoin(dialogId)
        return () => dialogLeave(dialogId)
    }, [dialogId, dialogLeave, dialogJoin])
    return <Fade in={typeof joinedDialog !== 'undefined'}>
        <MuiToolbar sx={{
            display: 'flex',
            pl: 0,
            pr: 1,
            flexGrow: 1,
            justifyContent: 'space-between',
            alignContent: 'center',
        }}>
            <IconButton
                sx={{display: 'flex', mr: 1}}
                color={'secondary'}
                size={'large'}
                onClick={() => navigate(routes.chat)}
            >
                <ArrowBackIosNew sx={{color: 'white'}}/>
            </IconButton>
            <Box sx={{position: 'relative', display: 'flex'}}>
                <Avatar>
                    {joinedDialog?.sender.name[0].toUpperCase()}
                </Avatar>
            </Box>
            <Box sx={{
                display: "flex",
                flexGrow: 1,
                flexDirection: "column",
                justifyContent: "space-between",
            }}>
                <Typography
                    align="center"
                    variant={"body1"}
                    variantMapping={{body1: 'h1'}}
                    noWrap
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                    {joinedDialog?.sender.name}
                </Typography>
                {!joinedDialog?.sender.isConnected &&
                    <Typography
                        align={'center'}
                        variant={'caption'}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        Был: {joinedDialog?.lastSentDate}
                    </Typography>
                }
            </Box>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyItems: 'space-between',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
            }}>
                <Box sx={{display: 'flex', justifyContent: "flex-end"}}>
                    <StatusText isConnected={joinedDialog?.sender.isConnected}/>
                    <StatusIcon
                        isConnected={joinedDialog?.sender.isConnected}
                        isMobile={joinedDialog?.sender.isConnected}
                        deviceModel={joinedDialog?.sender.deviceModel}
                    />
                </Box>
            </Box>
        </MuiToolbar>
    </Fade>
}
export default inject('user')(observer(ToolbarMobileDialog))