import type {HistoryHeader} from "./header"
import type {HistoryQuery} from "./query"
import type {HistoryPage} from "./page"
import type {HistoryBody} from "./body"
import type {HistoryEvidencePage} from "./evidence-page"

/** Transport и преобразование собственного backend принадлежат приложению. */
export type HistorySource<Header extends HistoryHeader, Body, Evidence> = Readonly<{
  readPage(conversationId: string, query: HistoryQuery, signal: AbortSignal): Promise<HistoryPage<Header>>
  readBody(conversationId: string, id: string, signal: AbortSignal): Promise<HistoryBody<Body>>
  readEvidence(conversationId: string, id: string, query: HistoryQuery, signal: AbortSignal): Promise<HistoryEvidencePage<Evidence>>
}>
