/**
Общее представление реплики: собственная — в плашке справа, чужая — в потоке.
Содержимое, сохранённое время и действие копирования принадлежат host беседы.
*/
import {useLayoutEffect, useRef, useState} from "@zavx0z/immersive-component"
import IconButton from "@zavx0z/immersive-ui-component-button-icon"
import svgIcon from "@zavx0z/immersive-tech-svg-encode"

const copyIcon = svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect x="5" y="5" width="9" height="9" rx="2" fill="none" stroke="#ccc"/><path d="M3 11H2V2h9v1" fill="none" stroke="#ccc"/></svg>')

export type MessageBubbleInput = Readonly<{
  id: string
  own: boolean
  label: string
  receivedAt?: string | undefined
  onCopy?: (() => void | Promise<void>) | undefined
}>

export default function MessageBubble(props: MessageBubbleInput) {
  const [copying, setCopying] = useState(false)
  const [feedback, setFeedback] = useState("")
  const pending = useRef(false)
  const alive = useRef(true)
  useLayoutEffect(() => {alive.current = true; return () => {alive.current = false}}, [])
  const copy = async () => {
    if (!props.onCopy || pending.current) return
    pending.current = true
    setCopying(true)
    try {
      await props.onCopy()
      if (alive.current) setFeedback("Скопировано")
    } catch {
      if (alive.current) setFeedback("Не удалось скопировать")
    } finally {
      pending.current = false
      if (alive.current) setCopying(false)
    }
  }
  const date = props.receivedAt === undefined ? null : new Date(props.receivedAt)
  const time = date !== null && Number.isFinite(date.getTime()) ? date.toLocaleTimeString("ru-RU", {hour: "2-digit", minute: "2-digit"}) : null
  return <article
    data-conversation-message={props.id}
    data-message-own={String(props.own)}
    aria-label={props.label}
    style={css`
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
      flex-shrink: 0;
      align-items: flex-start;
      gap: 4px;

      &[data-message-own="true"] {
        align-items: flex-end;
      }
    `}
  >
    <div
      data-message-bubble={props.own ? "self" : "other"}
      style={css`
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        min-width: 0;
        width: 100%;
        gap: 8px;
        padding: 4px 0;
        overflow-wrap: anywhere;

        &[data-message-bubble="self"] {
          width: fit-content;
          max-width: 90%;
          padding: 10px 16px;
          border-radius: 20px;
          background: rgb(var(--surface-750));
          color: var(--widget-regular-content);
          white-space: pre-wrap;
        }
      `}
    >
      <slot />
    </div>
    {props.onCopy || time ? <MessageActions
      own={props.own}
      feedback={feedback}
      copying={copying}
      onCopy={props.onCopy ? copy : undefined}
      receivedAt={props.receivedAt}
      time={time}
    /> : null}
  </article>
}

function MessageActions(props: Readonly<{own: boolean, feedback: string, copying: boolean, onCopy?: (() => Promise<void>) | undefined, receivedAt?: string | undefined, time: string | null}>) {
  return <footer
    aria-label="Действия сообщения"
    style={css`
      display: flex;
      flex-direction: row;
      align-items: center;
      align-self: ${props.own ? "flex-end" : "flex-start"};
      width: fit-content;
      max-width: 100%;
      gap: 8px;
      min-height: 24px;
      color: var(--widget-list-content);
      font-size: 12px;
    `}
  >
    {props.onCopy ? <IconButton
      label={props.copying ? "Копируется…" : props.feedback || "Скопировать сообщение"}
      title={props.copying ? "Копируется…" : props.feedback || "Скопировать сообщение"}
      iconSrc={copyIcon}
      iconSize={14}
      variant="text"
      onClick={() => {void props.onCopy?.()}}
    /> : null}
    {props.time ? <MessageTime receivedAt={props.receivedAt!} time={props.time} /> : null}
    {props.feedback ? <CopyFeedback text={props.feedback} /> : null}
  </footer>
}

function CopyFeedback(props: Readonly<{text: string}>) {
  return <span role="status">{props.text}</span>
}

function MessageTime(props: Readonly<{receivedAt: string, time: string}>) {
  return <time dateTime={props.receivedAt} title={new Date(props.receivedAt).toLocaleString("ru-RU")}>{props.time}</time>
}
