import {Chip, Fade, IconButton} from "@mui/material"
import MuiToolbar from "@mui/material/Toolbar"
import routes from "../../../routes/routes"
import {ArrowBackIosNew, DoneAll} from "@mui/icons-material"
import Typography from "@mui/material/Typography"
import * as React from "react"
import {useEffect} from "react"
import {inject, observer} from "mobx-react"
import {useNavigate, useParams} from "react-router-dom"
import Avatar from "@mui/material/Avatar"
import Box from "@mui/material/Box"
import StatusIcon from "../components/StatusIcon"

const ToolbarMobileDialog = ({user: {joinedDialog, dialogLeave, dialogJoin}}) => {
    const navigate = useNavigate()
    const {dialogId} = useParams()

    useEffect(() => {
        dialogId && dialogJoin(dialogId)
        return () => dialogLeave(dialogId)
    }, [dialogId, dialogLeave, dialogJoin])
    return <Fade timeout={444} in={typeof joinedDialog !== 'undefined'}>
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
                    {joinedDialog?.name[0].toUpperCase()}
                </Avatar>
                {!!joinedDialog?.unreadMessages ?
                    <Chip
                        sx={{
                            position: "absolute",
                            bottom: -4,
                            right: -7
                        }}
                        size={'small'}
                        color={'info'}
                        label={joinedDialog?.unreadMessages}
                    /> :
                    <DoneAll
                        sx={{
                            color: "secondary.dark",
                            position: "absolute",
                            bottom: -4,
                            right: -7
                        }}
                        fontSize={'small'}
                    />
                }
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
                    {joinedDialog?.name && joinedDialog.name === 'support' && "Чат поддержки"}
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
                    <Typography
                        color={joinedDialog?.sender.isConnected ? "info.main" : 'error'}
                        variant={"subtitle2"}
                        pr={.44}
                    >
                        {joinedDialog?.sender.isConnected ? "Online" : "Offline"}
                    </Typography>
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