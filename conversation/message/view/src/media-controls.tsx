import {useContext, useEffect, useRef, useState} from "@zavx0z/immersive-component"
import Button from "@zavx0z/immersive-ui-component-button-basic"
import {MediaHostContext} from "../../../media/host"
import type {MediaPreview} from "../contract/preview"

export function MediaNotice(props: Readonly<{text: string, media?: string | undefined, role?: "note" | "status" | "alert"}>) {
  return <p data-chat-media={props.media} role={props.role ?? "note"}>{props.text}</p>
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


/** Original — отдельное явное действие host; готовая вкладка уже не принадлежит overlay. */
export function MediaOriginal(props: Readonly<{media: MediaPreview}>) {
  const host = useContext(MediaHostContext)
  return <>
    {host?.openOriginal ? <OpenOriginal media={props.media} /> : null}
  </>
}

function OpenOriginal(props: Readonly<{media: MediaPreview}>) {
  const host = useContext(MediaHostContext)!
  const pending = useRef<AbortController | null>(null)
  const [state, setState] = useState("")
  useEffect(() => {
    setState("")
    return () => {pending.current?.abort(); pending.current = null}
  }, [props.media.source, host])
  return <div>
    <Button
      label="Открыть оригинал"
      disabled={state === "opening"}
      onClick={() => {
        // Ref закрывает повторный click ещё до component flush/disabled paint.
        if (pending.current) return
        const controller = new AbortController()
        pending.current = controller
        setState("opening")
        let opening: Promise<void>
        try {opening = host.openOriginal!(props.media, controller.signal)}
        catch (error) {
          pending.current = null
          setState(error instanceof Error ? error.message : String(error))
          return
        }
        void opening.then(() => {
          if (pending.current !== controller) return
          pending.current = null
          setState("")
        }, error => {
          if (pending.current !== controller) return
          pending.current = null
          if (!controller.signal.aborted) setState(error instanceof Error ? error.message : String(error))
        })
      }}
    />
    {state ? <MediaNotice text={state === "opening" ? "Открытие оригинала…" : state} /> : null}
  </div>
}
