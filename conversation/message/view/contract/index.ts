import type {JSX} from "@zavx0z/immersive-jsx-compiler-session"
import type {MessageContent} from "./content"
import type {MediaPreview} from "./preview"

/** Представление одного блока сообщения в текущем Document. */
export declare namespace ChatMessageView {
  /** Один реально полученный блок; host определяет порядок и lazy чтение. */
  type Input = Readonly<{content: MessageContent, plain?: boolean | undefined, onMedia?: ((media: MediaPreview) => void) | undefined}>
  type Output = JSX.Element
}
