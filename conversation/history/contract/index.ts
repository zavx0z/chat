import type {HistoryHeader} from "./header"
import type {HistoryInput} from "./options"
import type {HistoryController} from "./controller"

/** Контракт ограниченного окна истории; backend и содержимое определяет потребитель. */
export declare namespace ChatConversationHistory {
  type Input<Header extends HistoryHeader, Body, Evidence> = HistoryInput<Header, Body, Evidence>
  type Output<Header extends HistoryHeader, Body, Evidence> = HistoryController<Header, Body, Evidence>
}
