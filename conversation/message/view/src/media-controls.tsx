import {useContext, useEffect, useRef, useState} from "@zavx0z/immersive-component"
import Button from "@zavx0z/immersive-ui-component-button-basic"
import {MediaHostContext} from "../../../media/host"
import type {MediaPreview} from "../contract/preview"

export function MediaNotice(props: Readonly<{text: string, media?: string | undefined}>) {
  return <p data-chat-media={props.media} role="note">{props.text}</p>
}
export function MediaDownload(props: Readonly<{media: MediaPreview}>) {
  const host = useContext(MediaHostContext)
  const [state, setState] = useState("")
  const abort = useRef<AbortController | null>(null)
  useEffect(() => {
    setState("")
    return () => abort.current?.abort()
  }, [props.media.source])
  return <div>
    <Button
      label={state === "loading" ? "Скачивание…" : "Скачать оригинал"}
      disabled={!host || state === "loading"}
      onClick={() => {
        if (!host) return
        abort.current?.abort()
        const controller = new AbortController()
        abort.current = controller
        setState("loading")
        void host.download(props.media, controller.signal).then(() => {
          if (!controller.signal.aborted) setState("")
        }, error => {if (!controller.signal.aborted) setState(error instanceof Error ? error.message : String(error))})
      }}
    />
    {state && state !== "loading" ? <MediaNotice text={state} /> : null}
  </div>
}
