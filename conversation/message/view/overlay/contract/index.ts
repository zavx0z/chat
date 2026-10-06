import type {JSX} from "@zavx0z/immersive-jsx-compiler-session"
import type {MediaPreview} from "../../contract/preview"

/** Контракт открытого предпросмотра медиа. */
export declare namespace ChatMediaOverlay {
  /** Media размещается в ближайшем position:relative корне беседы того же Document. */
  type Input = Readonly<{media: MediaPreview, onClose(): void}>
  type Output = JSX.Element
}
