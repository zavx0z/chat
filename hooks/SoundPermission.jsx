import {useEffect, useState} from 'react'

const SoundPermission = ({children}) => {
  const [granted, setGranted] = useState(false)

  useEffect(() => {
    const handleClick = () => {
      if (!granted) {
        const AudioContext = window.AudioContext || window.webkitAudioContext
        const audioContext = new AudioContext()
        const buffer = audioContext.createBuffer(1, 1, 22050)
        const source = audioContext.createBufferSource()
        source.buffer = buffer
        source.connect(audioContext.destination)
        source.start()
        setGranted(true)
      }
    }

    document.body.addEventListener('click', handleClick)
    document.body.addEventListener('touchstart', handleClick)

    return () => {
      document.body.removeEventListener('click', handleClick)
      document.body.removeEventListener('touchstart', handleClick)
    }
  }, [granted])

  return granted ? children : null
}

export default SoundPermission
