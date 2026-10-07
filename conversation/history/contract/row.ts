import type {HistoryHeader} from "./header"
import type {HistoryEvidencePage} from "./evidence-page"

/** Малые сообщения живут вместе со страницей; тяжёлые подробности — пока нужны представлению. */
export type HistoryRow<Header extends HistoryHeader, Body, Evidence> = Readonly<{
  header: Header
  body?: Body | undefined
  evidence?: HistoryEvidencePage<Evidence> | undefined
  expanded: boolean
  loading: boolean
  error?: string | undefined
}>
