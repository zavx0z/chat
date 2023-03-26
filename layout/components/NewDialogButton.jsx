import React from "react"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import routes from "../../../../routes/routes"
import {useNavigate} from "react-router-dom"

export const NewDialogButton = () => {
    const navigate = useNavigate()
    return <Box sx={{p: 1}}>
        <Button
            fullWidth
            onClick={() => navigate(routes.projects)}
            color={"inherit"}
            variant={'contained'}
            size={'small'}
        >
            Создать проект
        </Button>
    </Box>
}