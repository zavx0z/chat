import type {HistoryHeader} from "./header"

/** Страница заголовков в возрастающем порядке ordinal. */
export type HistoryPage<Header extends HistoryHeader> = Readonly<{
  conversationId: string
  revision: number
  total: number
  start: number
  items: readonly Header[]
  before: number | null
  after: number | null
}>
