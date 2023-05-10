import {Fade, IconButton} from "@mui/material"
import MuiToolbar from "@mui/material/Toolbar"
import routes from "../../../routes/routes"
import {ArrowBackIosNew} from "@mui/icons-material"
import Typography from "@mui/material/Typography"
import * as React from "react"
import {useEffect, useState} from "react"
import {useNavigate, useParams} from "react-router-dom"
import Avatar from "@mui/material/Avatar"
import Box from "@mui/material/Box"
import NetworkStatusIcon from "../components/NetworkStatusIcon"
import {observer} from "mobx-react"
import NetworkStatusText from "../components/NetworkStatusText"
import store from "../../../model"

const ToolbarMobileDialog = () => {
    const navigate = useNavigate()
    const {dialogId} = useParams()
    const [dialog, setDialog] = useState(null)
    useEffect(() => {
        store.waitDialog(dialogId).then(setDialog)
    }, [dialogId])
    return <Fade in={!!dialog} mountOnEnter>
        <MuiToolbar sx={{
            display: 'flex',
            pl: 0,
            pr: 1,
            flexGrow: 1,
            justifyContent: 'space-between',
            alignContent: 'center',
        }}>
            <Box sx={{position: 'relative', display: 'flex'}}>
                <Avatar>
                    {dialog?.sender.name[0].toUpperCase()}
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
                    {dialog?.sender.name}
                </Typography>
                {!dialog?.sender.isConnected &&
                    <Typography
                        align={'center'}
                        variant={'caption'}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        Был: {dialog?.lastSentDate}
                    </Typography>
                }
            </Box>
        </MuiToolbar>
    </Fade>
}
export default observer(ToolbarMobileDialog)