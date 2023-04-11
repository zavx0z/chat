import {useEffect, useRef} from "react"
import wav from "../sound/notice.wav"
import ogg from "../sound/notice.ogg"
import mp3 from "../sound/notice.mp3"

import {observer} from "mobx-react"
import SoundPermission from "../hooks/SoundPermission"
import {types} from "mobx-state-tree"

export const notice = types
    .model({
        played: false
    })
    .actions(self => ({
        reset() {
            self.played = false
        },
        play() {
            self.played = true
        }
    })).create({})

const Notice = () => {
    const audioRef = useRef()
    const play = notice.played
    useEffect(() => {
        if (play)
            audioRef.current.play().then(() => notice.reset())
    }, [play])
    return <SoundPermission>
        <audio ref={audioRef}>
            <source src={wav} type="audio/wav"/>
            <source src={ogg} type="audio/ogg"/>
            <source src={mp3} type="audio/mp3"/>
        </audio>
    </SoundPermission>
}
export default observer(Notice)

