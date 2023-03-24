import {Done, DoneAll} from "@mui/icons-material"
import {Box} from "@mui/material"

const StatusMessage = ({status}) => {
    return <Box sx={{
        position: 'absolute',
        right: 1,
        bottom: 0,
    }}>
        {status === 'SENDING' && <Done sx={{color: "grey.400"}} fontSize={'small'}/>}
        {status === 'READING' && <DoneAll sx={{color: "primary.light"}} fontSize={'small'}/>}
        {status === 'WAITING' && <Done sx={{color: "primary.light"}} fontSize={'small'}/>}
    </Box>
}
export default StatusMessage