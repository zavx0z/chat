import {useEffect, useRef} from "react"
import wav from "../sound/notice.wav"
import ogg from "../sound/notice.ogg"
import mp3 from "../sound/notice.mp3"

import {inject, observer} from "mobx-react"
// import {useSnackbar} from "notistack"

const Notice = ({user: {noticePlay, setNoticePlay}}) => {
    const audioRef = useRef()
    // const {enqueueSnackbar} = useSnackbar()
    useEffect(() => {
        // audioRef.current.load()
        audioRef.current.volume = 1.0
        if (noticePlay) {
            console.log('notice play')
            audioRef.current.play().then(() => setNoticePlay(false))
        }
    }, [noticePlay, setNoticePlay])


    return <>
        <audio autoPlay ref={audioRef}>
            <source src={wav} type="audio/wav"/>
            <source src={ogg} type="audio/ogg"/>
            <source src={mp3} type="audio/mp3"/>
        </audio>
    </>
}
export default inject('user')(observer(Notice))

