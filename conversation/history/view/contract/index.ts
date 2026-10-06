import type {JSX} from "@zavx0z/immersive-jsx-compiler-session"
import type {HistoryViewport} from "../../contract"

/** Локальный viewport ограниченной истории, независимый от транспорта и автора записей. */
export declare namespace ChatHistoryView {
  /** Host child rows используют data-chat-history-id; тела и смысл записей остаются у host. */
  type Input = Readonly<{
    identity: string
    history: Readonly<{
      rows: readonly Readonly<{header: Readonly<{id: string}>}>[]
      total: number
      following: boolean
      after: number | null
      unread: number
      loading: boolean
      error?: string | undefined
    }>
    onViewport(value: HistoryViewport): void
    onVisible(value: boolean): void
    onTail(): void
    onRetry?: (() => void) | undefined
    onRowHeights?(heights: ReadonlyMap<string, number>): void
  }>
  /** Содержимое текущего ограниченного окна в том же semantic Document. */
  interface Slots {
    readonly default?: readonly (JSX.Element | string | number | bigint | null | undefined)[]
  }
  type Output = JSX.Element<Slots>
}
