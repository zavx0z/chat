import {useEffect, useRef} from "react"
import mp3 from "../notice.mp3"
import {inject, observer} from "mobx-react"

const Notice = ({user: {noticePlay, setNoticePlay}}) => {
    const audioRef = useRef(null)

    useEffect(() => {
        if (noticePlay)
            audioRef.current.play().then(() => setNoticePlay(false))
    }, [noticePlay, setNoticePlay])

    return <audio ref={audioRef}>
        <source src={mp3} type="audio/mp3"/>
    </audio>
}
export default inject('user')(observer(Notice))