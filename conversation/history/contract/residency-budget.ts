

/** Общий бюджет resident payload всех окон одного host, без привязки к протоколу чата. */
export type HistoryResidencyBudget = Readonly<{
  reserve(key: symbol, bodyBytes: number, evidenceBytes: number, evict: () => void): boolean
  release(key: symbol): void
  usage(): Readonly<{regularBytes: number; largeBytes: number; largeCount: number; entries: number}>
}>
