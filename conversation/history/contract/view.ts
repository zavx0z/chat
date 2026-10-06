import type {HistoryHeader} from "./header"
import type {HistoryRow} from "./row"

/** Ограниченное окно выбранной беседы и состояние его чтения. */
export type HistoryView<Header extends HistoryHeader, Body, Evidence> = Readonly<{
  conversationId: string | null
  revision: number
  total: number
  rows: readonly HistoryRow<Header, Body, Evidence>[]
  before: number | null
  after: number | null
  unread: number
  following: boolean
  loading: boolean
  error?: string | undefined
}>
