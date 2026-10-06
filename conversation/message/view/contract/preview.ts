import type {MediaAttachment} from "../../../media/browser"
/** Только открытый preview; закрытие освобождает ссылку host и не меняет сохранённое сообщение. */
export type MediaPreview = Readonly<{source: MediaAttachment | string, mimeType: string, label: string}>
