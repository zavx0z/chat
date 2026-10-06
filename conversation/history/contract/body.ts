

/** Тело одной записи. bytes отражает размер содержимого, а не всего транспорта. */
export type HistoryBody<Body> = Readonly<{
  conversationId: string
  id: string
  revision: number
  bytes: number
  entry: Body
  evidenceCount: number
}>
