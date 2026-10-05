/** Имена и действия над беседами; данные и авторизация принадлежат backend. */
import {useLayoutEffect, useRef, useState} from "@zavx0z/immersive-component"
import Button from "@zavx0z/immersive-ui-component-button-basic"
import IconButton from "@zavx0z/immersive-ui-component-button-icon"
import svgIcon from "@zavx0z/immersive-tech-svg-encode"
import {ConversationNameEditor} from "../header/src/name-editor"
import type {ChatConversationList as Contract} from "./contract"
export type {ChatConversationList} from "./contract"

const editIcon = svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="m3 10-1 4 4-1 8-8-3-3-8 8zm6-6 3 3" fill="none" stroke="#bbb" stroke-width="1.4"/></svg>')
const removeIcon = svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M3 4h10M6 4V2h4v2M4 4l1 10h6l1-10M7 6v6m2-6v6" fill="none" stroke="#bbb" stroke-width="1.4" stroke-linecap="round"/></svg>')

export default function ChatConversationList(props: Contract.Input) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [page, setPage] = useState(0)
  const located = useRef<string | undefined>(undefined)
  const alive = useRef(true)
  const working = useRef(false)
  useLayoutEffect(() => {alive.current = true; return () => {alive.current = false}}, [])
  useLayoutEffect(() => {
    if (props.selectedId === undefined || located.current === props.selectedId) return
    const index = props.items.findIndex(item => item.id === props.selectedId)
    if (index < 0) return
    located.current = props.selectedId
    setPage(Math.floor(index / 32))
  }, [props.selectedId, props.items])
  const perform = async (action: () => void | Promise<void>) => {
    if (working.current || props.busy) return
    working.current = true
    setPending(true)
    setError("")
    try { await action() }
    catch (failure) {if (alive.current) setError(failure instanceof Error ? failure.message : String(failure))}
    finally {working.current = false; if (alive.current) setPending(false)}
  }
  const busy = props.busy === true || pending
  const lastPage = Math.max(0, Math.ceil(props.items.length / 32) - 1)
  const currentPage = Math.min(page, lastPage)
  return <section
    data-conversation-list=""
    aria-label="Беседы"
    style={css`
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
      gap: 4px;
    `}
  >
    <Button label="Новая беседа" disabled={busy} onClick={() => {void perform(props.onCreate)}} />
    {props.items.slice(currentPage * 32, currentPage * 32 + 32).map(item => <ConversationRow
      key={item.id}
      id={item.id}
      title={item.title}
      selected={props.selectedId === item.id}
      editing={editingId === item.id}
      busy={busy}
      onSelect={() => props.onSelect(item.id)}
      onEdit={() => setEditingId(item.id)}
      onCancel={() => setEditingId(null)}
      onRename={title => props.onRename(item.id, title)}
      onDelete={() => {void perform(() => props.onDelete(item.id))}}
    />)}
    <div hidden={lastPage === 0} style={css`
      display: flex;
      flex-direction: row;
      gap: 4px;
      &[hidden] {
        display: none;
      }
    `}>
      <Button label="Предыдущие беседы" disabled={currentPage === 0 || busy} onClick={() => setPage(currentPage - 1)} />
      <Button label="Следующие беседы" disabled={currentPage === lastPage || busy} onClick={() => setPage(currentPage + 1)} />
    </div>
    <p hidden={error.length === 0} role="alert" style={css`
      margin: 0;
      &[hidden] {
        display: none;
      }
    `}>{error}</p>
  </section>
}

function ConversationRow(props: Readonly<{
  id: string, title: string, selected: boolean, editing: boolean, busy: boolean,
  onSelect(): void, onEdit(): void, onCancel(): void,
  onRename(title: string): void | Promise<void>, onDelete(): void,
}>) {
  return <div data-conversation-id={props.id} style={css`
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
  `}>
    <div hidden={props.editing} style={css`
      display: flex;
      flex-direction: row;
      align-items: center;
      width: 100%;
      min-width: 0;
      gap: 2px;
      &[hidden] {
        display: none;
      }
    `}>
      <Button
        label={props.title}
        title={props.title}
        selected={props.selected}
        disabled={props.busy}
        onClick={props.onSelect}
        style={css`
          flex-grow: 1;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        `}
      />
      <IconButton label="Переименовать беседу" title="Переименовать беседу" iconSrc={editIcon} iconSize={14} disabled={props.busy} onClick={props.onEdit} />
      <IconButton label="Удалить беседу" title="Удалить беседу" iconSrc={removeIcon} iconSize={14} disabled={props.busy} onClick={props.onDelete} />
    </div>
    {props.editing ? <ConversationNameEditor
      id={props.id}
      title={props.title}
      onSave={props.onRename}
      onSaved={props.onCancel}
      onCancel={props.onCancel}
    /> : null}
  </div>
}
