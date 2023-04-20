import * as React from "react"
import {useEffect, useState} from "react"
import {useParams} from "react-router-dom"
import {inject, observer} from "mobx-react"
import Typography from "@mui/material/Typography"
import {Fade, Slide} from "@mui/material"
import Avatar from "@mui/material/Avatar"
import Box from "@mui/material/Box"

const Companion = ({root: {waitDialog, waitUser}}) => {
    const [companion, setCompanion] = useState(null)
    const {dialogId} = useParams()
    useEffect(() => {
        waitDialog(dialogId).then(dialog => setCompanion(dialog.getCompanion()))
    }, [dialogId, waitDialog])
    return <Fade in={!!companion} mountOnEnter>
        <Box sx={{display: 'flex', gap: 1, width: "100%", alignItems: 'center', justifyContent: 'center'}}>
            <Box sx={{display: 'flex', alignItems: 'center'}}>
                <Avatar>
                    {companion?.name[0].toUpperCase()}
                </Avatar>
            </Box>
            <Box sx={{display: 'flex', flexDirection: 'column', flexGrow: 2}}>
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
                    {companion?.name}
                </Typography>
                <Slide in={!companion?.isConnected} mountOnEnter unmountOnExit direction={'up'}>
                    <Typography
                        align={'center'}
                        variant={'caption'}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        Был(а): {companion?.lastVisitHuman}
                    </Typography>
                </Slide>
            </Box>
            <Box sx={theme=>({display: 'flex', width: theme.spacing(4)})}/>
        </Box>
    </Fade>
}
export default inject('root')(observer(Companion))