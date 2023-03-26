import {Box, Chip} from "@mui/material"
import Typography from "@mui/material/Typography"
import {DoneAll} from "@mui/icons-material"
import React from "react"

export const DialogStatistic = ({lastSentDate, unreadMessages, status}) => {
    return <Box sx={{
        height: '100%',
        width: "100%",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        // alignContent: 'flex-end',
    }}>
        <Box sx={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
        }}>
            <Box>
                <Typography sx={{color: "secondary.dark", mr:1}} variant={'caption'}>
                    {status}
                </Typography>
            </Box>
            <Box>
                {!!!unreadMessages && <DoneAll sx={{color: "secondary.dark"}} fontSize={'small'}/>}
            </Box>
            <Box sx={{ml: 1}}>
                <Typography variant={'caption'}>
                    {lastSentDate}
                </Typography>
            </Box>
        </Box>
        <Box sx={{display: "flex", flexDirection: "row"}}>
            {!!unreadMessages && <Chip size={'small'} color={'info'} label={unreadMessages}/>}
        </Box>
    </Box>
}