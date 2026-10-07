import type {HistoryHeader} from "./header"
import type {HistorySource} from "./source"
import type {HistoryResidencyBudget} from "./residency-budget"

/**
Источник и смысл записи предоставляет host. isOrdinary разрешает чтение видимого
тела без отдельного раскрытия; validateBody проверяет собственный формат backend.
Контроллер не вводит права пользователей, protocol авторов или хранение истории.
*/
export type HistoryInput<Header extends HistoryHeader, Body, Evidence> = Readonly<{
  source: HistorySource<Header, Body, Evidence>
  isOrdinary(header: Header): boolean
  validateBody?(body: Body, header: Header): Body
  validateHeader?(header: Header): boolean
  /** Один owner передаёт тот же budget всем своим окнам, чтобы лимит не умножался. */
  residencyBudget?: HistoryResidencyBudget
  /** Число заголовков одной страницы и resident страниц; малые вложенные окна используют тот же controller. */
  pageSize?: number
  maxPages?: number
  /** Объединяет поток ревизий перед повторным чтением хвоста; первое открытие не задерживается. */
  refreshDelayMs?: number
  changed(): void
}>
