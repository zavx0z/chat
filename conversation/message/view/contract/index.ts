import type {JSX} from "@zavx0z/immersive-jsx-compiler-session"
import type {MediaAttachment} from "../../../media/browser"
/** Блоки UI не принадлежат wire protocol: лишняя metadata остаётся у backend/host. */
export type MessageContent =
  | Readonly<{type: "text", text: string}>
  | Readonly<{type: "image" | "audio", data: string, mimeType: string}>
  | Readonly<{type: "resource_link", uri: string, name: string, title?: string | null, description?: string | null}>
  | Readonly<{type: "resource", resource: Readonly<{uri: string, mimeType?: string | null} & ({text: string} | {blob: string})>}>

/** Только открытый preview; закрытие освобождает ссылку host и не меняет сохранённое сообщение. */
export type MediaPreview = Readonly<{source: MediaAttachment | string, mimeType: string, label: string}>

export declare namespace ChatMessageView {
  /** Один реально полученный блок; host определяет порядок и lazy чтение. */
  type Input = Readonly<{content: MessageContent, plain?: boolean | undefined, onMedia?: ((media: MediaPreview) => void) | undefined}>
  type Output = JSX.Element
}

export declare namespace ChatMediaOverlay {
  /** Media размещается в ближайшем position:relative корне беседы того же Document. */
  type Input = Readonly<{media: MediaPreview, onClose(): void}>
  type Output = JSX.Element
}
