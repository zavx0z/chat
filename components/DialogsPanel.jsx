import React, {useEffect} from "react"
import {Box, Chip, List, ListItemAvatar, ListItemSecondaryAction, ListItemText, TextField} from "@mui/material"
import ListItemButton from "@mui/material/ListItemButton"
import Avatar from "@mui/material/Avatar"
import {useNavigate, useParams} from "react-router-dom"
import routes from "../../../routes/routes"
import {observer} from "mobx-react"
import Typography from "@mui/material/Typography"
import {DoneAll} from "@mui/icons-material"

const DialogsPanel = ({dialogs, dialogJoin, dialogLeave}) => {
    const navigate = useNavigate()
    const {dialogId} = useParams()
    useEffect(() => {
        dialogId && dialogJoin(dialogId)
        return () => dialogLeave(dialogId)
    }, [dialogId, dialogLeave])
    return <>
        <TextField
            fullWidth
            size={'small'}
            variant={'outlined'}
            placeholder={'поиск'}
        />
        <List sx={{pt: 0}}>
            {dialogs.map((dialog) =>
                <ListItemButton
                    key={dialog.id}
                    divider
                    dense
                    selected={parseInt(dialogId) === dialog.id}
                    onClick={() => navigate(routes.chat + '/' + dialog.id)}
                >
                    <ListItemAvatar>
                        <Avatar>
                            {dialog.username[0]}
                        </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                        primary={dialog.username}
                        primaryTypographyProps={{
                            fontWeight: 'bold',
                        }}
                        secondary={dialog.lastMessage}
                        secondaryTypographyProps={{
                            noWrap: true,
                            sx: {maxWidth: !!dialog.unreadMessages ? '90%' : '100%'}
                        }}
                    >
                    </ListItemText>
                    <ListItemSecondaryAction sx={{
                        flexGrow: 1,
                        height: "100%",
                        pt: 2,
                    }}>
                        <Box sx={{
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
                                    {!!!dialog.unreadMessages && <DoneAll sx={{color: "secondary.dark"}} fontSize={'small'}/>}
                                </Box>
                                <Box sx={{ml: 1}}>
                                    <Typography variant={'caption'}>
                                        {dialog.lastSentDate}
                                    </Typography>
                                </Box>
                            </Box>
                            <Box sx={{display: "flex", flexDirection: "row"}}>
                                {!!dialog.unreadMessages && <Chip size={'small'} color={'info'} label={dialog.unreadMessages}/>}
                            </Box>
                        </Box>
                    </ListItemSecondaryAction>
                </ListItemButton>)}
        </List>
    </>
}
export default observer(DialogsPanel)