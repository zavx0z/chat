import HistoryView from "../index"
import {Button} from "@zavx0z/immersive/ui"
import type {HistoryViewport} from "../../contract/viewport"

type Snapshot = Readonly<{rows: readonly {header: {id: string}}[], total: number, following: boolean, after: null, unread: number, loading: false}>
export type Props = Readonly<{
  outer: Snapshot
  inner: Snapshot
  expanded: boolean
  assistantHeight: number
  onToggle(value: boolean): void
  onOuterViewport(viewport: HistoryViewport): void
  onInnerViewport(viewport: HistoryViewport): void
}>
export default function IntentFixture(props: Props) {
  return <div style={css`
    display: flex;
    flex-direction: column;
    width: 360px;
    height: 320px;
    min-height: 0;
  `}>
    <HistoryView identity="outer" history={props.outer} onViewport={props.onOuterViewport} onVisible={() => {}} onTail={() => {}}>
      <IntentRows expanded={props.expanded} assistantHeight={props.assistantHeight} inner={props.inner} onToggle={props.onToggle} onInnerViewport={props.onInnerViewport} />
    </HistoryView>
  </div>
}
function IntentRows(props: Readonly<Pick<Props, "expanded" | "assistantHeight" | "inner" | "onToggle" | "onInnerViewport">>) {
  return <div style={css`
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 8px;
    flex-shrink: 0;
  `}>
    <div data-chat-history-id="past" style={css`
      height: 1400px;
      flex-shrink: 0;
    `}>Предыдущие сообщения</div>
    <div data-chat-history-id="group" style={css`
      flex-shrink: 0;
    `}>
      <IntentHeader expanded={props.expanded} onToggle={props.onToggle} />
      {props.expanded ? <IntentInner history={props.inner} onViewport={props.onInnerViewport} /> : null}
    </div>
    <div data-chat-history-id="assistant" style={css`
      height: ${props.assistantHeight}px;
      flex-shrink: 0;
    `}>Ответ ассистента после группы</div>
  </div>
}
function IntentInner(props: Readonly<{history: Snapshot, onViewport(viewport: HistoryViewport): void}>) {
  return <div style={css`
    display: flex;
    flex-direction: column;
    height: 320px;
    min-height: 0;
  `}>
    <HistoryView identity="inner" history={props.history} onViewport={props.onViewport} onVisible={() => {}} onTail={() => {}}>
      <IntentInnerRows rows={props.history.rows} />
    </HistoryView>
  </div>
}
function IntentInnerRows(props: Readonly<{rows: Snapshot["rows"]}>) {
  return <div>
    {props.rows.map(row => <IntentInnerRow key={row.header.id} id={row.header.id} />)}
  </div>
}
function IntentInnerRow(props: Readonly<{id: string}>) {
  return <div data-chat-history-id={props.id} style={css`
    height: 60px;
  `}>{props.id}</div>
}

function IntentHeader(props: Readonly<{expanded: boolean, onToggle(value: boolean): void}>) {
  return <Button
    label="Действия агента"
    aria-expanded={String(props.expanded)}
    onClick={() => props.onToggle(!props.expanded)}
    style={css`
      width: 100%;
      height: 26px;
    `}
  />
}
