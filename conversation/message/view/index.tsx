/** Текст, изображения и embedded resources сообщения в общем Document, независимо от backend. */
import {useEffect, useMemo, useRef, useState} from "@zavx0z/immersive-component"
import {Markdown} from "@zavx0z/immersive-markdown"
import {observeElementLayout} from "@zavx0z/immersive-dom"
import {prepareMediaImage, type MediaAttachment, type PreparedMediaImage} from "../../media/browser"
import CodeEditor from "@zavx0z/immersive-ui-component-view-code-editor"
import Button from "@zavx0z/immersive-ui-component-button-basic"
import type {ChatMessageView as Contract, ChatMediaOverlay as OverlayContract, MessageContent, MediaPreview} from "./contract"
export type {ChatMessageView, ChatMediaOverlay, MessageContent, MediaPreview} from "./contract"

export default function ChatMessageView(props: Contract.Input) {
  const block = props.content
  return <div>
    {block.type === "text" ? <MessageText text={block.text} plain={props.plain === true} /> : null}
    {block.type === "image" ? <MessageImage data={block.data} mimeType={block.mimeType} label="Изображение в сообщении" onMedia={props.onMedia} /> : null}
    {block.type === "audio" ? <MediaNotice text={`Аудио · ${block.mimeType}. Воспроизведение пока недоступно.`} media="audio" /> : null}
    {block.type === "resource_link" ? <ResourceLink content={block} /> : null}
    {block.type === "resource" ? <EmbeddedResource content={block} onMedia={props.onMedia} /> : null}
  </div>
}

function MessageText(props: Readonly<{text: string, plain: boolean}>) {
  const large = props.text.length > 65536
  return <div>
    {large ? <LargeText text={props.text} /> : null}
    {!large && props.plain ? <PlainText text={props.text} /> : null}
    {!large && !props.plain ? <MarkdownText text={props.text} /> : null}
  </div>
}
function PlainText(props: Readonly<{text: string}>) {
  return <div data-chat-message-text="">{props.text}</div>
}
function MarkdownText(props: Readonly<{text: string}>) {
  return <Markdown
    source={props.text}
    wrap={true}
    style={css`
      width: 100%;
      min-width: 0;
      flex-shrink: 0;
      overflow-wrap: anywhere;
      font-size: 14px;
      line-height: 1.5;
    `}
  />
}
function LargeText(props: Readonly<{text: string}>) {
  return <CodeEditor
    title="Сообщение"
    value={props.text}
    languageId="plaintext"
    readOnly={true}
    showLineNumbers={false}
    style={css`
      width: 100%;
      min-width: 0;
      height: auto;
      max-height: 240px;
      overflow: auto;
      flex-shrink: 0;
    `}
  />
}
function MessageImage(props: Readonly<{data: string, mimeType: string, label: string, onMedia?: ((media: MediaPreview) => void) | undefined}>) {
  const source: MediaAttachment = useMemo(() => ({id: crypto.randomUUID(), name: props.label, kind: "image", mimeType: props.mimeType,
    bytes: Math.floor(props.data.length * 3 / 4), data: props.data}), [props.mimeType, props.data, props.label])
  return <ImagePreview media={{source, mimeType: props.mimeType, label: props.label}} onMedia={props.onMedia} />
}

/** Thumbnail готовится штатным browser image processor; original source в img не передаётся. */
export function ImagePreview(props: Readonly<{media: MediaPreview, onMedia?: ((media: MediaPreview) => void) | undefined}>) {
  const [prepared, setPrepared] = useState<PreparedMediaImage | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    let lease: PreparedMediaImage | null = null
    setPrepared(null)
    setError("")
    void prepareMediaImage({source: props.media.source, mode: "thumbnail", signal: controller.signal, isCurrent: () => !controller.signal.aborted}).then(image => {
      if (controller.signal.aborted) {image?.release(); return}
      lease = image
      setPrepared(image)
    }, failure => {if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : String(failure))})
    return () => {controller.abort(); lease?.release()}
  }, [props.media.source])
  return <div>
    {prepared ? <PreparedImage media={props.media} image={prepared} onMedia={props.onMedia} /> : null}
    {!prepared ? <MediaNotice text={error || "Подготовка изображения…"} /> : null}
  </div>
}
function PreparedImage(props: Readonly<{media: MediaPreview, image: PreparedMediaImage, onMedia?: ((media: MediaPreview) => void) | undefined}>) {
  return <button
    type="button"
    aria-label={`Открыть: ${props.media.label}`}
    onClick={() => props.onMedia?.(props.media)}
    style={css`
      display: block;
      width: auto;
      max-width: 100%;
      padding: 0;
      border: 0;
      background: transparent;
    `}
  >
    <img
      data-chat-image=""
      src={props.image.url}
      width={props.image.width}
      height={props.image.height}
      alt={props.media.label}
      style={css`
        display: block;
        max-width: 100%;
        max-height: 200px;
        height: auto;
        aspect-ratio: ${props.image.width} / ${props.image.height};
        object-fit: contain;
      `}
    />
  </button>
}
function MediaNotice(props: Readonly<{text: string, media?: string | undefined}>) {
  return <p data-chat-media={props.media} role="note">{props.text}</p>
}
function ResourceLink(props: Readonly<{content: Extract<MessageContent, {type: "resource_link"}>}>) {
  const block = props.content
  const label = (block.title ?? block.name).replace(/[\[\]\\]/gu, "\\$&")
  const uri = block.uri.replace(/[\s()]/gu, character => encodeURIComponent(character))
  const text = `[${label}](${uri})${block.description ? `\n\n${block.description}` : ""}`
  return <MarkdownText text={text} />
}
function EmbeddedResource(props: Readonly<{content: Extract<MessageContent, {type: "resource"}>, onMedia?: ((media: MediaPreview) => void) | undefined}>) {
  const resource = props.content.resource
  const image = "blob" in resource && resource.mimeType?.startsWith("image/")
  return <section data-chat-resource={resource.uri}>
    <MarkdownText text={resource.uri} />
    {"text" in resource ? <MessageText text={resource.text} plain={false} /> : null}
    {image && "blob" in resource ? <MessageImage data={resource.blob} mimeType={resource.mimeType!} label={resource.uri} onMedia={props.onMedia} /> : null}
    {"blob" in resource && !image ? <MediaNotice text={`Бинарный ресурс · ${resource.mimeType ?? "неизвестный формат"}. Просмотр пока недоступен.`} /> : null}
  </section>
}

/** Inline overlay сохраняет тот же semantic Document; host очищает media при закрытии/смене беседы. */
export function MediaOverlay(props: OverlayContract.Input) {
  const root = useRef<HTMLElement | null>(null)
  const [prepared, setPrepared] = useState<PreparedMediaImage | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
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
        const image = await prepareMediaImage({source: props.media.source, mode: "preview", viewport: {width: box.width, height: box.height, dpr}, signal: controller.signal, isCurrent: () => !controller.signal.aborted})
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
    return () => {controller.abort(); unsubscribe(); lease?.release()}
  }, [props.media.source])
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
    {prepared ? <OverlayImage image={prepared} label={props.media.label} /> : null}
    {!prepared ? <MediaNotice text={error || "Подготовка изображения…"} /> : null}
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
