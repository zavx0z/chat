import View from "../index"
import type {HistoryView, HistoryHeader, HistoryViewport} from "../../contract"

export type Body = Readonly<{height: number}>
export type Props = Readonly<{
  hidden: boolean
  onVisible(value: boolean): void
  history: HistoryView<HistoryHeader, Body, unknown>
  heights: ReadonlyMap<string, number>
  onViewport(value: HistoryViewport): void
  onHeights(heights: ReadonlyMap<string, number>): void
  onTail(): void
}>

/** Настоящий slot consumer с переменной высотой и выгрузкой body; callbacks связаны с controller. */
export default function Fixture(props: Props) {
  return <div
    hidden={props.hidden}
    style={css`
      display: flex;
      flex-direction: column;
      width: 360px;
      height: 320px;
      min-width: 0;
      min-height: 0;
    `}
  >
    <View
      identity="conversation"
      history={props.history}
      onViewport={props.onViewport}
      onVisible={props.onVisible}
      onRowHeights={props.onHeights}
      onTail={props.onTail}
    >
      <Rows rows={props.history.rows} heights={props.heights} />
    </View>
  </div>
}
function Rows(props: Readonly<Pick<Props, "heights"> & {rows: Props["history"]["rows"]}>) {
  return <div style={css`
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: 100%;
    gap: 12px;
  `}>
    {props.rows.map(row => <Row key={row.header.id} id={row.header.id} height={row.body?.height ?? props.heights.get(row.header.id) ?? 80} />)}
  </div>
}
function Row(props: Readonly<{id: string, height: number}>) {
  return <div
    data-chat-history-id={props.id}
    style={css`
      flex-shrink: 0;
      box-sizing: border-box;
      min-height: ${props.height}px;
      width: 100%;
      background: #444444;
    `}
  >{props.id}</div>
}
