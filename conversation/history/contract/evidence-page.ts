

/** Отдельная страница подробностей одной записи; backend определяет их смысл. */
export type HistoryEvidencePage<Evidence> = Readonly<{
  conversationId: string
  id: string
  revision: number
  total: number
  start: number
  items: readonly Evidence[]
  before: number | null
  after: number | null
}>
