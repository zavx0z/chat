/** Общий composer сообщения: стандартный textarea/IME, отправка и host slots. */
import {useState} from "@zavx0z/immersive-component"
import Button from "@zavx0z/immersive-ui-component-button-basic"
import IconButton from "@zavx0z/immersive-ui-component-button-icon"
import svgIcon from "@zavx0z/immersive-tech-svg-encode"
import type {ChatMessageComposer as Contract} from "./contract"
import {ImagePreview, type MediaPreview} from "../view"
import type {MediaDraftAttachment} from "../../media/browser"
export type {ChatMessageComposer} from "./contract"

const sendIcon = svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 20V4m-7 7 7-7 7 7" fill="none" stroke="#161616" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>')
const stopIcon = svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" fill="#161616"/></svg>')


export default function ChatMessageComposer(props: Contract.Input) {
  const [focused, setFocused] = useState(false)
  const pending = props.canCancel === true
  const canSend = !props.busy && (props.draft.trim().length > 0 || (props.attachments?.length ?? 0) > 0)
  return <div
    data-chat-composer=""
    style={css`
      box-sizing: border-box;
      position: relative;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      min-width: 0;
      width: 100%;
      gap: 8px;
      padding: 12px;
      border: 1px solid var(--widget-regular-outline);
      border-radius: 20px;
      background: rgb(var(--surface-750));

      &:focus-within {
        border-color: var(--widget-focus-outline);
      }
    `}
  >
    {(props.attachments?.length ?? 0) > 0 ? <AttachmentStrip
      attachments={props.attachments ?? []}
      onRemove={props.onRemove}
      onPreview={props.onPreview}
    /> : null}
    <textarea
      data-chat-input=""
      role="textbox"
      aria-multiline="true"
      aria-label="Сообщение"
      placeholder={focused || props.draft.length > 0 ? "" : "Напишите сообщение…"}
      value={props.draft}
      rows={Math.max(3, Math.min(12, props.draft.split("\n").length))}
      onFocus={() => {
        setFocused(true)
        props.onFocus?.()
      }}
      onBlur={() => setFocused(false)}
      onInput={event => props.onDraftChange(event.currentTarget.value)}
      onKeyDown={event => {
        if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return
        event.preventDefault()
        if (canSend && !event.repeat) props.onSend()
      }}
      style={css`
        box-sizing: border-box;
        display: block;
        width: 100%;
        min-width: 0;
        min-height: 72px;
        max-height: 180px;
        padding: 2px 0;
        border: 0;
        background: transparent;
        color: var(--widget-list-content);
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        overflow-x: hidden;
        overflow-y: auto;
      `}
    />
    <div
      style={css`
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        min-width: 0;
        gap: 8px;
      `}
    >
      <slot />
      {props.onAttach ? <AttachButton onAttach={props.onAttach} busy={props.busy} /> : null}
      <IconButton
        label={pending ? "Остановить" : "Отправить"}
        title={pending ? "Остановить ответ" : "Отправить сообщение (Enter)"}
        iconSrc={pending ? stopIcon : sendIcon}
        iconSize={22}
        variant="contained"
        disabled={!pending && !canSend}
        onClick={() => {
          if (pending) props.onCancel()
          else if (canSend) props.onSend()
        }}
        style={css`
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          min-height: 36px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: #f5f5f5;
          color: #161616;
          --widget-hover-background: #ffffff;
          --widget-regular-background-selected: #dddddd;
          --widget-regular-content-selected: #161616;
        `}
      />
    </div>
  </div>
}

function AttachButton(props: Readonly<{busy: boolean, onAttach(): void}>) {
  return <button type="button" aria-label="Прикрепить файл" disabled={props.busy} onClick={props.onAttach}>+</button>
}

/** Восемь preview занимают одну прокручиваемую строку, не вытесняют composer controls. */
function AttachmentStrip(props: Readonly<{
  attachments: readonly MediaDraftAttachment[]
  onRemove?: ((id: string) => void) | undefined
  onPreview?: ((attachment: MediaDraftAttachment) => void) | undefined
}>) {
  return <div
    data-chat-attachment-strip=""
    aria-label="Вложения сообщения"
    style={css`
      box-sizing: border-box;
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      flex-shrink: 0;
      width: 100%;
      min-width: 0;
      min-height: 0;
      max-height: 160px;
      gap: 8px;
      padding-bottom: 4px;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: thin;
    `}
  >
    {props.attachments.map(attachment => <DraftAttachment
      key={attachment.attachment.id}
      attachment={attachment}
      onRemove={props.onRemove}
      onPreview={props.onPreview}
    />)}
  </div>
}

function DraftAttachment(props: Readonly<{attachment: MediaDraftAttachment, onRemove?: ((id: string) => void) | undefined, onPreview?: ((attachment: MediaDraftAttachment) => void) | undefined}>) {
  const image = props.attachment.attachment.kind === "image"
  const media: MediaPreview = {source: props.attachment.attachment, mimeType: props.attachment.attachment.mimeType, label: props.attachment.attachment.name}
  return <div
    data-chat-draft-attachment={props.attachment.attachment.id}
    style={css`
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      flex: 0 0 132px;
      width: 132px;
      max-width: 132px;
      height: 144px;
      min-width: 0;
      min-height: 0;
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--widget-regular-outline);
      border-radius: 8px;
      overflow: hidden;
    `}
  >
    {image ? <DraftImagePreview media={media} onPreview={() => props.onPreview?.(props.attachment)} /> : null}
    <div
      style={css`
        display: flex;
        flex-direction: row;
        align-items: center;
        flex-shrink: 0;
        min-width: 0;
        width: 100%;
        gap: 4px;
      `}
    >
      <Button
        label={props.attachment.attachment.name}
        title={props.attachment.attachment.name}
        variant="text"
        onClick={() => props.onPreview?.(props.attachment)}
        style={css`
          display: block;
          flex: 1 1 0;
          min-width: 0;
          max-width: 100%;
          height: 24px;
          padding: 2px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 12px;
        `}
      />
      <Button
        label="×"
        title="Удалить вложение"
        aria-label="Удалить вложение"
        variant="text"
        onClick={() => props.onRemove?.(props.attachment.attachment.id)}
        style={css`
          flex: 0 0 24px;
          width: 24px;
          height: 24px;
          min-width: 24px;
          min-height: 24px;
          padding: 0;
        `}
      />
    </div>
  </div>
}

function DraftImagePreview(props: Readonly<{media: MediaPreview, onPreview(): void}>) {
  return <div
    data-chat-draft-preview=""
    style={css`
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 104px;
      width: 100%;
      height: 104px;
      min-width: 0;
      min-height: 0;
      overflow: hidden;

    `}
  >
    <ImagePreview media={props.media} onMedia={props.onPreview} />
  </div>
}
