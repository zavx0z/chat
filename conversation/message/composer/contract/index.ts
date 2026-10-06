import type {JSX} from "@zavx0z/immersive-jsx-compiler-session"
import type {MediaDraftAttachment} from "../../../media/browser"

/** Управляемый ввод сообщения; backend/model/agent state остаётся у host. */
export declare namespace ChatMessageComposer {
  type Input = Readonly<{
    draft: string
    busy: boolean
    /** Отправка может ждать применения параметров, сохраняя доступными ввод и вложения. */
    sendDisabled?: boolean | undefined
    canCancel?: boolean | undefined
    sendLabel?: string | undefined
    attachments?: readonly MediaDraftAttachment[] | undefined
    onDraftChange(value: string): void
    onSend(): void
    onCancel(): void
    onAttach?: (() => void) | undefined
    /** Файлы из стандартного drop; подготовка и пределы вложений принадлежат принимающему владельцу. */
    onFiles?: ((files: readonly File[]) => void) | undefined
    onRemove?: ((id: string) => void) | undefined
    onPreview?: ((attachment: MediaDraftAttachment) => void) | undefined
    onFocus?: (() => void) | undefined
  }>
  /** Host предоставляет модель/контекст и другие собственные controls. */
  interface Slots {
    readonly default?: readonly (JSX.Element | string | number | bigint | null | undefined)[]
  }
  type Output = JSX.Element<Slots>
}
