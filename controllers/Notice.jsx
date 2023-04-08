import {useEffect, useRef} from "react"
import mp3 from "../sound/notice.mp3"
import wav from "../sound/notice.wav"
import ogg from "../sound/notice.ogg"

import {inject, observer} from "mobx-react"

const Notice = ({user: {noticePlay, setNoticePlay}}) => {
    const audioRef = useRef(null)

    useEffect(() => {
        if (noticePlay) {
            console.log('notice play')
            audioRef.current.load()
            audioRef.current.volume = 1.0
            audioRef.current.play().then(() => setNoticePlay(false))
        }
    }, [noticePlay, setNoticePlay])

    return <audio ref={audioRef}>
        <source src={wav} type="audio/wav"/>
        <source src={ogg} type="audio/ogg"/>
        <source src={mp3} type="audio/mp3"/>
    </audio>
}
export default inject('user')(observer(Notice))