import React from "react"
import {List} from "@mui/material"
import {useNavigate, useParams} from "react-router-dom"
import routes from "../../../routes/routes"
import {observer} from "mobx-react"
import Box from "@mui/material/Box"
import {isMobile} from "react-device-detect"
import Divider from "@mui/material/Divider"
import DialogListItem from "../components/DialogListItem"

const DialogList = ({dialogs, children}) => {
    const navigate = useNavigate()
    const {dialogId} = useParams()
    return <Box sx={theme => ({
        height: '100%',
        position: 'relative',
        minWidth: isMobile ? '100%' : 400,
        backgroundColor: '#fff',
        borderRight: `${isMobile ? 0 : 1}px solid ${theme.palette.grey[300]}`,
        overflow: 'auto'
    })}>
        <List sx={{
            pt: 0,
            pb: 0
        }}>
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
        {children}
        <Divider/>
    </Box>
}
export default observer(DialogList)