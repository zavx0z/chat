/** Текст, изображения и embedded resources сообщения в общем Document, независимо от backend. */
import {component, provideContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState} from "@zavx0z/immersive/XReact"
import {Markdown, MarkdownMediaContext, type MarkdownProps, type MarkdownMediaHost, type MarkdownImageSource} from "@zavx0z/immersive/markdown"
import {prepareMediaImage, type MediaAttachment, type PreparedMediaImage} from "../../media/browser"
import {CodeEditor} from "@zavx0z/immersive/ui"
import {Button} from "@zavx0z/immersive/ui"
import type {CompiledTemplate} from "@zavx0z/immersive/XReact/compiled"
import type {JSX} from "@zavx0z/immersive/XReact"
import {MediaHostContext, loadMediaSource} from "../../media/host"
export {MediaHostContext, mediaAttachmentBlob, downloadMediaBlob} from "../../media/host"
export type {MediaHost, MediaSource, MediaAudioPlayback, MediaAudioState} from "../../media/host"
import type {ChatMessageView as Contract} from "./contract"
import type {MessageContent} from "./contract/content"
import type {MediaPreview} from "./contract/preview"
export type {ChatMessageView} from "./contract"
export type {ChatMediaOverlay} from "./overlay/contract"
export type {MessageContent} from "./contract/content"
export type {MediaPreview} from "./contract/preview"
import {MediaNotice, MediaDownload} from "./src/media-controls"
import {observeElementLayout} from "@zavx0z/immersive"

export default function ChatMessageView(props: Contract.Input) {
  const block = props.content
  return <div>
    {block.type === "text" ? <MessageText text={block.text} plain={props.plain === true} onMedia={props.onMedia} /> : null}
    {block.type === "image" ? <MessageImage data={block.data} mimeType={block.mimeType} label="Изображение в сообщении" onMedia={props.onMedia} /> : null}
    {block.type === "audio" ? <MessageBinary data={block.data} mimeType={block.mimeType} label="Аудио" kind="audio" onMedia={props.onMedia} /> : null}
    {block.type === "resource_link" ? <ResourceLink content={block} onMedia={props.onMedia} /> : null}
    {block.type === "resource" ? <EmbeddedResource content={block} onMedia={props.onMedia} /> : null}
  </div>
}

function MessageText(props: Readonly<{text: string, plain: boolean, onMedia?: ((media: MediaPreview) => void) | undefined}>) {
  const large = props.text.length > 65536
  return <div>
    {large ? <LargeText text={props.text} /> : null}
    {!large && props.plain ? <PlainText text={props.text} /> : null}
    {!large && !props.plain ? <MarkdownText text={props.text} onMedia={props.onMedia} /> : null}
  </div>
}
function PlainText(props: Readonly<{text: string}>) {
  return <div data-chat-message-text="">{props.text}</div>
}
function MarkdownText(props: Readonly<{text: string, onMedia?: ((media: MediaPreview) => void) | undefined}>) {
  const host = useContext(MediaHostContext)
  const bridge = useMemo<MarkdownMediaHost>(() => ({
    linkTarget: "_blank",
    renderImage(image) {return markdownImageContent(image, props.onMedia)},
    async loadImage(image, signal) {
      try {
        const prepared = await prepareMediaImage({source: image.src, mode: "thumbnail", signal, cache: host?.images,
          loader: signal => loadMediaSource(image.src, host, signal)})
        if (!prepared) throw new DOMException("Загрузка отменена", "AbortError")
        return prepared
      } catch (error) {
        // Retry уже не встретит неудачный вариант; Markdown API/kernel менять не требуется.
        if (!signal.aborted) host?.images?.invalidate(image.src)
        throw error
      }
    },
    openImage(image) {props.onMedia?.({source: image.src, mimeType: "image/*", label: image.alt || "Изображение"})},
  }), [host, props.onMedia])
  const content: MarkdownContentValue = markdownWithMedia(props.text, bridge)
  return <MarkdownContent>{content}</MarkdownContent>
}
type MarkdownContentValue = JSX.Element | readonly JSX.Element[] | null | undefined
function markdownWithMedia(source: string, host: MarkdownMediaHost): MarkdownContentValue {
  return provideContext(MarkdownMediaContext, host,
    component(Markdown as unknown as CompiledTemplate<MarkdownProps>, {source, wrap: true})) as unknown as JSX.Element
}
function markdownImageContent(image: MarkdownImageSource, onMedia: ((media: MediaPreview) => void) | undefined): JSX.Element {
  return component(ChatMarkdownImage as unknown as CompiledTemplate<Readonly<{image: MarkdownImageSource, onMedia: typeof onMedia}>>,
    {image, onMedia}) as unknown as JSX.Element
}

/** Тот же thumbnail lifecycle обслуживает вложение и изображение внутри Markdown. */
function ChatMarkdownImage(props: Readonly<{image: MarkdownImageSource, onMedia?: ((media: MediaPreview) => void) | undefined}>) {
  const media = useMemo<MediaPreview>(() => ({source: props.image.src, mimeType: "image/*", label: props.image.alt || "Изображение"}), [props.image.src, props.image.alt])
  return <ImagePreview
    media={media}
    retryLabel="Повторить загрузку"
    onMedia={props.onMedia}
  />
}

function MarkdownContent() {
  return <div
    style={css`
      width: 100%;
      min-width: 0;
      flex-shrink: 0;
      overflow-wrap: anywhere;
      font-size: 14px;
      line-height: 1.5;
    `}
  >
    <slot />
  </div>
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
export function ImagePreview(props: Readonly<{media: MediaPreview, retryLabel?: string, onMedia?: ((media: MediaPreview) => void) | undefined}>) {
  const element = useRef<HTMLElement | null>(null)
  const [active, setActive] = useState(false)
  const [dimensions, setDimensions] = useState<Readonly<{width: number, height: number}> | null>(null)
  const [prepared, setPrepared] = useState<PreparedMediaImage | null>(null)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const host = useContext(MediaHostContext)
  useLayoutEffect(() => {
    const target = element.current
    if (!target) return
    const viewports: HTMLElement[] = []
    let parent = target.parentElement
    while (parent) {
      if (parent.hasAttribute("data-chat-messages")) viewports.push(parent)
      parent = parent.parentElement
    }
    // В самостоятельной карточке/overlay lifecycle остаётся прежним. В истории
    // видимость проверяется во всех enclosing viewport, включая вложенные группы.
    if (viewports.length === 0) {setActive(true); return}
    let disposed = false
    let pending = false
    const schedule = () => {
      if (pending || disposed) return
      pending = true
      queueMicrotask(() => {
        pending = false
        if (disposed) return
        setActive(viewports.every(viewport => {
          const box = viewport.getLayoutRect()
          const rect = target.getLayoutRect(viewport)
          return box !== null && rect !== null && box.width > 0 && box.height > 0 &&
            rect.bottom > 0 && rect.top < box.height && rect.right > 0 && rect.left < box.width
        }))
      })
    }
    const releases = viewports.flatMap(viewport => [
      observeElementLayout(viewport, schedule),
      observeElementLayout(target, schedule, {relativeTo: viewport}),
    ])
    schedule()
    return () => {disposed = true; for (const release of releases) release()}
  }, [])
  useEffect(() => {setDimensions(null)}, [props.media.source])
  useEffect(() => {
    setPrepared(null)
    if (!active) return
    const controller = new AbortController()
    let lease: PreparedMediaImage | null = null
    setError("")
    void prepareMediaImage({source: props.media.source, mode: "thumbnail", signal: controller.signal, cache: host?.images,
      loader: signal => loadMediaSource(props.media.source, host, signal)}).then(image => {
      if (controller.signal.aborted) {image?.release(); return}
      lease = image
      if (image) setDimensions({width: image.width, height: image.height})
      setPrepared(image)
    }, failure => {if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : String(failure))})
    return () => {controller.abort(); lease?.release()}
  }, [props.media.source, host, attempt, active])
  const geometry = prepared ?? dimensions
  return <div ref={value => {element.current = value}}>
    {geometry ? <PreparedImage
      media={props.media}
      image={geometry}
      active={active}
      onMedia={props.onMedia}
    /> : null}
    {!geometry ? <MediaNotice text={error || "Подготовка изображения…"} role={error ? "alert" : active ? "status" : "note"} /> : null}
    {error ? <Button label={props.retryLabel ?? "Повторить"} onClick={() => {host?.images?.invalidate(props.media.source); setAttempt(attempt + 1)}} /> : null}
  </div>
}
function PreparedImage(props: Readonly<{media: MediaPreview, image: Readonly<{width: number, height: number, url?: string}>, active: boolean, onMedia?: ((media: MediaPreview) => void) | undefined}>) {
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
      src={props.active ? props.image.url : undefined}
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
function MessageBinary(props: Readonly<{data: string, mimeType: string, label: string, kind: "audio" | "file", onMedia?: ((media: MediaPreview) => void) | undefined}>) {
  const media = useMemo<MediaPreview>(() => ({
    source: {id: crypto.randomUUID(), name: props.label, kind: props.kind, mimeType: props.mimeType, bytes: Math.floor(props.data.length * 3 / 4), data: props.data},
    mimeType: props.mimeType, label: props.label,
  }), [props.data, props.mimeType, props.label, props.kind])
  return <div>
    <Button label={props.label} onClick={() => props.onMedia?.(media)} />
    <MediaNotice text={props.mimeType} />
    <MediaDownload media={media} />
  </div>
}

function ResourceLink(props: Readonly<{content: Extract<MessageContent, {type: "resource_link"}>, onMedia?: ((media: MediaPreview) => void) | undefined}>) {
  const block = props.content
  const media = useMemo<MediaPreview>(() => ({source: block.uri, mimeType: block.mimeType ?? "application/octet-stream", label: block.title ?? block.name}), [block.uri, block.mimeType, block.title, block.name])
  return <section
    data-chat-resource-link=""
    style={css`
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    `}
  >
    {media.mimeType.startsWith("image/") ? <ImagePreview media={media} onMedia={props.onMedia} /> : null}
    <Button label={media.label} variant="text" onClick={() => props.onMedia?.(media)} />
    <MediaNotice text={`${media.mimeType}${block.size == null ? "" : ` · ${formatBytes(block.size)}`}`} />
    {block.description ? <MediaNotice text={block.description} /> : null}
    <MediaDownload media={media} />
  </section>
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} Б` : bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} КиБ` : `${(bytes / (1024 * 1024)).toFixed(1)} МиБ`
}

function EmbeddedResource(props: Readonly<{content: Extract<MessageContent, {type: "resource"}>, onMedia?: ((media: MediaPreview) => void) | undefined}>) {
  const resource = props.content.resource
  const image = "blob" in resource && resource.mimeType?.startsWith("image/")
  return <section data-chat-resource={resource.uri}>
    <MarkdownText text={resource.uri} />
    {"text" in resource ? <MessageText text={resource.text} plain={false} /> : null}
    {image && "blob" in resource ? <MessageImage data={resource.blob} mimeType={resource.mimeType!} label={resource.uri} onMedia={props.onMedia} /> : null}
    {"blob" in resource && !image ? <MessageBinary data={resource.blob} mimeType={resource.mimeType ?? "application/octet-stream"} label={resource.uri} kind="file" onMedia={props.onMedia} /> : null}
  </section>
}


export {default as MediaOverlay} from "./overlay"
