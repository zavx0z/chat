import {useEffect, useState} from "react"

const IsOnline = () => {
    const [online, setOnline] = useState(navigator.onLine)
    useEffect(() => {
        const setOnLine = () => setOnline(true)
        const setOffline = () => setOnline(false)
        window.addEventListener('offline', setOffline)
        window.addEventListener('online', setOnLine)
        return () => {
            window.removeEventListener('online', setOnLine)
            window.removeEventListener('offline', setOffline)
        }
    }, [setOnline])
    return online
}
export default IsOnline