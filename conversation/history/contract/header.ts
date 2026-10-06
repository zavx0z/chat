

/** Минимальный заголовок. Поля конкретного сообщения предоставляет backend. */
export type HistoryHeader = Readonly<{id: string; ordinal: number; revision: number; bodyBytes: number; evidenceCount: number}>
