import {createContext} from "@zavx0z/immersive-component"
import type {MediaAttachment, MediaImageCache} from "./browser"
import type {MediaPreview} from "../message/view/contract/preview"

export type MediaSource = MediaAttachment | string
export type MediaAudioState = Readonly<{playing: boolean, currentTime: number, duration: number, error: string | null}>
export type MediaAudioPlayback = Readonly<{play(): Promise<void>, pause(): void, seek(seconds: number): void, dispose(): void}>
/** Browser host владеет авторизацией, разрешением resource identity и native download. */
export type MediaHost = Readonly<{
  /** Cache ограничен lifetime и доступом этой беседы; host освобождает его вместе с клиентом. */
  images?: MediaImageCache | undefined
  load(source: MediaSource, signal: AbortSignal): Promise<Blob>
  download(media: MediaPreview, signal: AbortSignal): Promise<void>
  createAudio?(blob: Blob, changed: (state: MediaAudioState) => void): MediaAudioPlayback
}>
export const MediaHostContext = createContext<MediaHost | null>(null)

/** Материализует локальное вложение, не обращаясь к сети. */
export function mediaAttachmentBlob(source: MediaAttachment): Blob {
  if (source.text !== undefined) return new Blob([source.text], {type: source.mimeType})
  if (typeof source.data !== "string") throw new Error("Оригинал вложения недоступен")
  const binary = atob(source.data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], {type: source.mimeType})
}

export async function loadMediaSource(source: MediaSource, host: MediaHost | null, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted()
  if (typeof source !== "string") return mediaAttachmentBlob(source)
  const internal = /^\/__chat_media\/([a-f0-9]{64})$/u.exec(source)
  if (host) return await host.load(internal ? `chat-media:${internal[1]}` : source, signal)
  if (!source.startsWith("blob:")) throw new Error("Доставка изображения недоступна. Повторите после подключения чата.")
  const response = await fetch(source, {signal})
  if (!response.ok) throw new Error("Не удалось прочитать медиа")
  return await response.blob()
}

/** Невидимый native anchor передаёт download браузеру в том же host Document; новый UI/Canvas не создаётся. */
export function downloadMediaBlob(document: Document, blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = name.replace(/[\u0000-\u001f\u007f/\\]/gu, "_").slice(0, 512) || "Вложение"
  anchor.hidden = true
  document.body.append(anchor)
  try {anchor.click()} finally {
    anchor.remove()
    // Browser download успевает получить Blob до освобождения URL.
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}
