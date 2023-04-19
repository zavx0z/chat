import React from "react"
import {LinearProgress, List} from "@mui/material"
import {useNavigate, useParams} from "react-router-dom"
import routes from "../../../routes/routes"
import {inject, observer} from "mobx-react"
import Box from "@mui/material/Box"
import {isMobile} from "react-device-detect"
import DialogListItem from "../components/DialogListItem"

const drawerWidth = 400
const width = isMobile ? {width: "100%"} : {minWidth: drawerWidth, maxWidth: drawerWidth}
const drawerStyle = theme => ({
    ...width,
    height: '100%',
    position: 'relative',
    backgroundColor: '#fff',
    overflow: 'auto',
    overscrollBehavior: 'auto',
    ...!isMobile && {borderRight: `1px solid ${theme.palette.grey[300]}`},
})

const DialogList = ({children, root: {dialogs, loadingDialogs}}) => {
    const navigate = useNavigate()
    const {dialogId} = useParams()
    return <Box sx={theme => drawerStyle(theme)}>
        {loadingDialogs ?
            <LinearProgress/> :
            <List sx={{pt: 0, pb: 0}}>
                {dialogs.map((dialog) =>
                    <DialogListItem
                        key={dialog.id}
                        selected={parseInt(dialogId) === dialog.id}
                        handleClick={() => navigate(routes.chat + '/' + dialog.id)}
                        dialogTitle={dialog.title}
                        unreadMessages={dialog.unreadMessages}
                        lastMessage={dialog.lastMessage}
                        isConnected={dialog.sender.isConnected}
                        deviceModel={dialog.sender.deviceModel}
                        lastVisit={dialog.sender.lastVisit}
                    />
                )}
            </List>
        }
        {children}
    </Box>
}
export default inject('root')(observer(DialogList))