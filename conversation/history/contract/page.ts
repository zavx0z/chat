import type {HistoryBody} from "./body"
import type {HistoryHeader} from "./header"

/** Страница заголовков и необязательных малых тел в возрастающем порядке ordinal. */
export type HistoryPage<Header extends HistoryHeader, Body = never> = Readonly<{
  conversationId: string
  revision: number
  total: number
  start: number
  items: readonly Header[]
  /** Не более 128 KiB сериализованных тел; только обычные сообщения той же ревизии. */
  bodies?: readonly HistoryBody<Body>[]
  before: number | null
  after: number | null
}>
