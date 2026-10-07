import HistoryView from "../index"
import Button from "@zavx0z/immersive-ui-component-button-basic"
import type {ChatHistoryView} from "../contract"

export type Row = Readonly<{id: string, height: number, group?: boolean}>
export type Props = Readonly<{
  history: ChatHistoryView.Input["history"]
  rows: readonly Row[]
  expanded: boolean
  onViewport: ChatHistoryView.Input["onViewport"]
  onToggle(value: boolean): void
}>

/** Производственный HistoryView задаёт настоящий padding 12px, overflow и измеряемое содержимое. */
export default function ContinuousScrollFixture(props: Props) {
  return <div style={css`
    display: flex;
    flex-direction: column;
    width: 360px;
    height: 320px;
    min-height: 0;
  `}>
    <HistoryView
      identity="continuous"
      history={props.history}
      onViewport={props.onViewport}
      onVisible={() => {}}
      onTail={() => {}}
    >
      <ContinuousRows
        rows={props.rows}
        expanded={props.expanded}
        onToggle={props.onToggle}
      />
    </HistoryView>
  </div>
}

function ContinuousRows(props: Readonly<Pick<Props, "rows" | "expanded" | "onToggle">>) {
  return <div style={css`
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 20px;
    flex-shrink: 0;
  `}>
    {props.rows.map(row => <ContinuousRow
      key={row.id}
      row={row}
      expanded={props.expanded}
      onToggle={props.onToggle}
    />)}
  </div>
}
function ContinuousRow(props: Readonly<{row: Row, expanded: boolean, onToggle(value: boolean): void}>) {
  return <article
    data-chat-history-id={props.row.id}
    style={css`
      min-height: ${props.row.height}px;
      flex-shrink: 0;
    `}
  >
    {props.row.group ? <ContinuousGroup expanded={props.expanded} onToggle={props.onToggle} /> : <ContinuousText id={props.row.id} />}
  </article>
}
function ContinuousText(props: Readonly<{id: string}>) {
  return <p>{props.id}: обычное сообщение</p>
}
function ContinuousGroup(props: Readonly<{expanded: boolean, onToggle(value: boolean): void}>) {
  return <div>
    <Button
      label="Действия агента"
      aria-expanded={String(props.expanded)}
      onClick={() => props.onToggle(!props.expanded)}
      style={css`
        height: 26px;
        width: 100%;
      `}
    />
    {props.expanded ? <ContinuousDetails /> : null}
  </div>
}
function ContinuousDetails() {
  return <div style={css`
    height: 260px;
  `}>Раскрытые подробности</div>
}
