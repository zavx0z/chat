/** Предпросмотр изображения, файла или аудио внутри текущей беседы. */
import {useContext, useEffect, useRef, useState} from "@zavx0z/immersive/XReact"
import {observeElementLayout} from "@zavx0z/immersive"
import {Button} from "@zavx0z/immersive/ui"
import {SliderField} from "@zavx0z/immersive/ui"
import {prepareMediaImage, type PreparedMediaImage} from "../../../media/browser"
import {MediaHostContext, loadMediaSource, type MediaAudioPlayback, type MediaAudioState} from "../../../media/host"
import type {MediaPreview} from "../contract/preview"
import type {ChatMediaOverlay as OverlayContract} from "./contract"
import {MediaNotice, MediaDownload, MediaOriginal} from "../src/media-controls"
export type {ChatMediaOverlay} from "./contract"

/** Inline overlay сохраняет тот же semantic Document; host очищает media при закрытии/смене беседы. */
export default function MediaOverlay(props: OverlayContract.Input) {
  return <>
    {props.media.mimeType.startsWith("image/") ? <ImageOverlay media={props.media} onClose={props.onClose} /> : <FileOverlay media={props.media} onClose={props.onClose} />}
  </>
}
function FileOverlay(props: OverlayContract.Input) {
  const root = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const previous = root.current?.ownerDocument.activeElement as HTMLElement | null
    root.current?.focus()
    return () => {if (previous?.isConnected) previous.focus()}
  }, [])
  return <section
    ref={element => {root.current = element}}
    role="dialog"
    data-chat-media-overlay=""
    aria-label={props.media.label}
    tabIndex={-1}
    onKeyDown={event => {if (event.key === "Escape") props.onClose()}}
    style={css`
      position: absolute;
      inset: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: rgb(var(--surface-750));
    `}
  >
    <Button label="Закрыть" onClick={props.onClose} />
    <h3>{props.media.label}</h3>
    <MediaNotice text={props.media.mimeType} />
    {props.media.mimeType.startsWith("audio/") ? <AudioControls media={props.media} /> : <MediaNotice text="Сохраните оригинал, чтобы открыть его в приложении." />}
    <MediaDownload media={props.media} />
  </section>
}
/** Playback принадлежит native host, controls и состояние остаются в текущем semantic Document. */
function AudioControls(props: Readonly<{media: MediaPreview}>) {
  const host = useContext(MediaHostContext)
  const player = useRef<MediaAudioPlayback | null>(null)
  const [state, setState] = useState<MediaAudioState>({playing: false, currentTime: 0, duration: 0, error: null})
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setReady(false)
    setState({playing: false, currentTime: 0, duration: 0, error: null})
    if (!host?.createAudio) {
      setState({playing: false, currentTime: 0, duration: 0, error: "Воспроизведение в этом приложении недоступно"})
      return () => controller.abort()
    }
    void loadMediaSource(props.media.source, host, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      player.current = host.createAudio!(blob, value => {if (!controller.signal.aborted) setState(value)})
      setReady(true)
    }).catch(error => {if (!controller.signal.aborted) setState({playing: false, currentTime: 0, duration: 0, error: error instanceof Error ? error.message : String(error)})})
    return () => {controller.abort(); player.current?.dispose(); player.current = null}
  }, [props.media.source, host, attempt])
  return <div
    style={css`
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    `}
  >
    <Button
      label={state.playing ? "Пауза" : "Воспроизвести"}
      disabled={!ready}
      onClick={() => {
        if (state.playing) player.current?.pause()
        else void player.current?.play().catch(error => setState({...state, error: error instanceof Error ? error.message : String(error)}))
      }}
    />
    <SliderField
      label="Позиция воспроизведения"
      min={0}
      max={Math.max(1, state.duration)}
      step={0.1}
      value={state.currentTime}
      disabled={!ready || state.duration <= 0}
      onInput={value => player.current?.seek(value)}
    />
    <MediaNotice text={state.error || `${Math.floor(state.currentTime)} / ${Math.floor(state.duration)} с`} />
    {state.error ? <Button label="Повторить" onClick={() => setAttempt(attempt + 1)} /> : null}
  </div>
}

function ImageOverlay(props: OverlayContract.Input) {
  const host = useContext(MediaHostContext)
  const [attempt, setAttempt] = useState(0)
  const root = useRef<HTMLElement | null>(null)
  const [prepared, setPrepared] = useState<PreparedMediaImage | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    const previous = root.current?.ownerDocument.activeElement as HTMLElement | null
    root.current?.focus()
    setPrepared(null)
    setError("")
    let lease: PreparedMediaImage | null = null
    let lastSize = ""
    let pending = false
    const prepare = async (): Promise<void> => {
      const box = root.current?.getLayoutRect()
      if (!box || box.width <= 0 || box.height <= 0 || pending || controller.signal.aborted) return
      const dpr = globalThis.devicePixelRatio || 1
      const key = `${box.width}:${box.height}:${dpr}`
      if (key === lastSize) return
      lastSize = key
      pending = true
      try {
        const image = await prepareMediaImage({source: props.media.source, mode: "preview", cache: host?.images,
          viewport: {width: box.width, height: box.height, dpr}, signal: controller.signal,
          loader: signal => loadMediaSource(props.media.source, host, signal)})
        if (controller.signal.aborted) {image?.release(); return}
        lease?.release()
        lease = image
        setPrepared(image)
      } catch (failure) {if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : String(failure))}
      finally {
        pending = false
        // Последний resize мог прийти во время декодирования: измеряем актуальную область.
        if (!controller.signal.aborted) queueMicrotask(() => {void prepare()})
      }
    }
    const unsubscribe = root.current ? observeElementLayout(root.current, () => {void prepare()}) : () => {}
    void prepare()
    return () => {
      controller.abort()
      unsubscribe()
      lease?.release()
      if (previous?.isConnected) previous.focus()
    }
  }, [props.media.source, host, attempt])
  return <section
    ref={element => {root.current = element}}
    role="dialog"
    tabIndex={-1}
    aria-label={props.media.label}
    onKeyDown={event => {if (event.key === "Escape") {event.preventDefault(); props.onClose()}}}
    data-chat-media-overlay=""
    style={css`
      position: absolute;
      inset: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      background: rgb(var(--surface-750));
    `}
  >
    <Button
      label="Закрыть"
      aria-label="Закрыть медиа"
      onClick={props.onClose}
    />
    <MediaOriginal media={props.media} />
    <MediaDownload media={props.media} />
    <MediaNotice text="Предпросмотр статичный. Оригинал сохраняет исходный формат." />
    {prepared ? <OverlayImage image={prepared} label={props.media.label} /> : null}
    {!prepared ? <MediaNotice text={error || "Подготовка изображения…"} /> : null}
    {error ? <Button label="Повторить" onClick={() => {host?.images?.invalidate(props.media.source); setAttempt(attempt + 1)}} /> : null}
  </section>
}
function OverlayImage(props: Readonly<{image: PreparedMediaImage, label: string}>) {
  return <img
    data-chat-full-image=""
    src={props.image.url}
    width={props.image.width}
    height={props.image.height}
    alt={props.label}
    style={css`
      display: block;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      object-fit: contain;
    `}
  />
}
