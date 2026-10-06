

/** Видимый диапазон принадлежит представлению, не backend или исполнению автора. */
export type HistoryViewport = Readonly<{ids: readonly string[]; nearStart: boolean; nearEnd: boolean; following: boolean}>
