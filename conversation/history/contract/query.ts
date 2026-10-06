

/** Ordinal задаёт место записи; before/after — исключительные границы. */
export type HistoryQuery = Readonly<{before?: number; after?: number; around?: number; limit?: number; maxBytes?: number}>
