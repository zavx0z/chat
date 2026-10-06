import type {HistoryHeader} from "./header"
import type {HistoryEvidencePage} from "./evidence-page"

/** Содержимое присутствует только у нужных сейчас записей. */
export type HistoryRow<Header extends HistoryHeader, Body, Evidence> = Readonly<{
  header: Header
  body?: Body | undefined
  /** Измеренная видимость строки не зависит от revision её payload. */
  visible?: boolean
  evidence?: HistoryEvidencePage<Evidence> | undefined
  expanded: boolean
  loading: boolean
  error?: string | undefined
}>
