import type {HistorySummary} from "./summary"

/**
Выбранная беседа. Необязательный scope различает одинаковые id разных источников;
его изменение отзывает запросы и освобождает данные прежнего выбора.
*/
export type HistorySelection = Readonly<{id: string; scope?: string; history: HistorySummary}>
