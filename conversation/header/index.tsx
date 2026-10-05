/** Имя беседы не зависит от вида автора и backend приложения. */
import {useState} from "@zavx0z/immersive-component"
import IconButton from "@zavx0z/immersive-ui-component-button-icon"
import svgIcon from "@zavx0z/immersive-tech-svg-encode"
import {ConversationNameEditor} from "./src/name-editor"
import type {ChatConversationHeader as Contract} from "./contract"
export type {ChatConversationHeader} from "./contract"

const editIcon = svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="m3 10-1 4 4-1 8-8-3-3-8 8zm6-6 3 3" fill="none" stroke="#bbb" stroke-width="1.4" stroke-linejoin="round"/></svg>')

export default function ChatConversationHeader(props: Contract.Input) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = editingId === props.id
  return <header
    data-conversation-header={props.id}
    style={css`
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
      flex-shrink: 0;
      padding: 4px 8px;
      color: var(--widget-list-content);
      background: var(--widget-number-background-readonly);
    `}
  >
    <div hidden={editing} style={css`
      display: flex;
      flex-direction: row;
      align-items: center;
      width: 100%;
      min-width: 0;
      min-height: 26px;
      gap: 6px;
      &[hidden] {
        display: none;
      }
    `}>
      <span title={props.title} style={css`
        display: block;
        flex-grow: 1;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      `}>{props.title}</span>
      <IconButton
        label="Переименовать беседу"
        title="Переименовать беседу"
        iconSrc={editIcon}
        iconSize={16}
        disabled={props.busy === true}
        onClick={() => setEditingId(props.id)}
      />
    </div>
    {editing ? <ConversationNameEditor
      key={props.id}
      id={props.id}
      title={props.title}
      onSave={props.onRename}
      onSaved={() => setEditingId(null)}
      onCancel={() => setEditingId(null)}
    /> : null}
  </header>
}
