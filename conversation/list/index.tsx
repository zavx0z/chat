/** Имена и действия над беседами; данные и авторизация принадлежат backend. */
import {useLayoutEffect, useRef, useState} from "@zavx0z/immersive/XReact"
import {Button} from "@zavx0z/immersive/ui"
import {IconButton} from "@zavx0z/immersive/ui"
import svgIcon from "@zavx0z/immersive/ui/svg"
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
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const located = useRef<string | undefined>(undefined)
  const alive = useRef(true)
  const working = useRef(false)
  useLayoutEffect(() => {alive.current = true; return () => {alive.current = false}}, [])
  useLayoutEffect(() => {setPage(0); setEditingId(null); setConfirmingId(null)}, [props.trashOpen])
  useLayoutEffect(() => {
    if (props.trashOpen || props.selectedId === undefined || located.current === props.selectedId) return
    const index = props.items.findIndex(item => item.id === props.selectedId)
    if (index < 0) return
    located.current = props.selectedId
    setPage(Math.floor(index / 32))
  }, [props.selectedId, props.items, props.trashOpen])
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
  const items = props.trashOpen ? props.deletedItems ?? [] : props.items
  const lastPage = Math.max(0, Math.ceil(items.length / 32) - 1)
  const currentPage = Math.min(page, lastPage)
  const activeItems = props.trashOpen ? [] : props.items.slice(currentPage * 32, currentPage * 32 + 32)
  const trashItems = props.trashOpen ? (props.deletedItems ?? []).slice(currentPage * 32, currentPage * 32 + 32) : []
  return <section
    data-conversation-list=""
    aria-label={props.trashOpen ? "Корзина бесед" : "Беседы"}
    style={css`
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
      gap: 4px;
    `}
  >
    {props.onTrashToggle ? <Button
      label={props.trashOpen ? "Вернуться к беседам" : "Корзина"}
      disabled={busy}
      onClick={() => props.onTrashToggle?.(!props.trashOpen)}
    /> : null}
    {!props.trashOpen ? <Button label="Новая беседа" disabled={busy} onClick={() => {void perform(props.onCreate)}} /> : null}
    {props.trashOpen && items.length === 0 && !busy ? <EmptyTrash /> : null}
    {trashItems.map(item => <DeletedConversation
      key={item.id}
      id={item.id}
      title={item.title}
      recoverable={item.recoverable !== false}
      busy={busy}
      confirming={confirmingId === item.id}
      onRestore={props.onRestore === undefined ? undefined : () => {void perform(() => props.onRestore?.(item.id))}}
      onAskPurge={props.onPurge === undefined ? undefined : () => setConfirmingId(item.id)}
      onCancel={() => setConfirmingId(null)}
      onConfirm={() => {void perform(async () => {await props.onPurge?.(item.id); if (alive.current) setConfirmingId(null)})}}
    />)}
    {activeItems.map(item => <ConversationRow
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
      <IconButton label="В корзину" title="Переместить беседу в корзину" iconSrc={removeIcon} iconSize={14} disabled={props.busy} onClick={props.onDelete} />
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

/** Необратимое действие подтверждается здесь, без native dialog или скрытого выбора. */
function DeletedConversation(props: Readonly<{
  id: string, title: string, recoverable: boolean, busy: boolean, confirming: boolean,
  onRestore: (() => void) | undefined, onAskPurge: (() => void) | undefined,
  onCancel(): void, onConfirm(): void,
}>) {
  return <section
    data-deleted-conversation={props.id}
    style={css`
      display: flex;
      flex-direction: column;
      min-width: 0;
      gap: 6px;
      padding-block: 8px;
    `}
  >
    <strong>{props.title}</strong>
    {!props.recoverable ? <RecoveryNotice /> : null}
    <Button
      label="Восстановить"
      disabled={props.busy || !props.recoverable || props.onRestore === undefined}
      onClick={props.onRestore}
    />
    <Button
      label="Удалить навсегда…"
      disabled={props.busy || props.onAskPurge === undefined}
      onClick={props.onAskPurge}
    />
    {props.confirming ? <PurgeConfirmation
      title={props.title}
      busy={props.busy}
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
    /> : null}
  </section>
}


function EmptyTrash() {return <p>Корзина пуста.</p>}
function RecoveryNotice() {return <p>Восстановление недоступно. Можно завершить окончательное удаление.</p>}

function PurgeConfirmation(props: Readonly<{title: string, busy: boolean, onCancel(): void, onConfirm(): void}>) {
  return <section
      role="alertdialog"
      aria-label="Подтверждение окончательного удаления"
      style={css`
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        border: 1px solid var(--widget-regular-outline);
        border-radius: 6px;
      `}
    >
      <p>Удалить «{props.title}» навсегда? Историю этой беседы восстановить не получится.</p>
      <Button
        label="Отмена"
        disabled={props.busy}
        onClick={props.onCancel}
      />
      <Button
        label="Да, удалить навсегда"
        tone="error"
        disabled={props.busy}
        onClick={props.onConfirm}
      />
    </section>
}
