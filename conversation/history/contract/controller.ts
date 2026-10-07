import type {HistorySelection} from "./selection"
import type {HistoryHeader} from "./header"
import type {HistoryViewport} from "./viewport"
import type {HistoryView} from "./view"

/**
Окно содержит не больше трёх страниц по 32 заголовка, 4 MiB обычных bodies и
evidence плюс одно большое содержимое до 16 MiB. Малые обычные тела до 128 KiB
остаются в том же бюджете и в UI при выходе из viewport.
Eviction страницы, скрытие всего окна и disposal освобождают их. Не больше четырёх запросов
одновременно; скрытие, collapse и смена беседы abort-ят ненужное чтение.
После eviction возвращение к записи снова читает источник. Общий residencyBudget
применяет эти byte limits к сумме всех окон host, а не к каждому независимо.
Лимиты относятся к сериализованному payload; это не оценка полного JS/GPU/RSS.
*/
export type HistoryController<Header extends HistoryHeader, Body, Evidence> = Readonly<{
  getSnapshot(): HistoryView<Header, Body, Evidence>
  accept(selection: HistorySelection): void
  setActive(active: boolean): void
  viewport(viewport: HistoryViewport): void
  expand(id: string, expanded: boolean): void
  retry(id: string): void
  retryPage(): void
  tail(): void
  evidence(id: string, after?: number): Promise<void>
  dispose(): void
}>
