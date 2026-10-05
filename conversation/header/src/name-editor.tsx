import {useLayoutEffect, useRef, useState} from "@zavx0z/immersive-component"
import Button from "@zavx0z/immersive-ui-component-button-basic"
import TextField from "@zavx0z/immersive-ui-component-field-text"

/** Подтверждение сохраняет ввод при отказе, смена identity отзывает поздний ответ. */
export function ConversationNameEditor(props: Readonly<{
  id: string
  title: string
  onSave(title: string): void | Promise<void>
  onCancel(): void
  onSaved(): void
}>) {
  const [text, setText] = useState(props.title)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const root = useRef<HTMLElement | null>(null)
  const generation = useRef(0)
  const saving = useRef(false)
  useLayoutEffect(() => {
    generation.current++
    setText(props.title)
    root.current?.querySelector<HTMLInputElement>("input")?.focus()
    return () => {generation.current++}
  }, [props.id])
  const save = async () => {
    if (saving.current) return
    const title = text.trim()
    if (!title || title.length > 128) {setError("Введите имя от 1 до 128 символов"); return}
    const epoch = generation.current
    saving.current = true
    setPending(true)
    setError("")
    try {
      await props.onSave(title)
      if (generation.current === epoch) props.onSaved()
    } catch (failure) {
      if (generation.current === epoch) setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      saving.current = false
      if (generation.current === epoch) setPending(false)
    }
  }
  return <div
    ref={element => {root.current = element}}
    data-conversation-name-editor=""
    role="group"
    aria-label="Имя беседы"
    onKeyDown={event => {
      if (event.isComposing) return
      if (event.key === "Enter") {event.preventDefault(); void save()}
      if (event.key === "Escape" && !pending) {event.preventDefault(); props.onCancel()}
    }}
    style={css`
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
      gap: 4px;
    `}
  >
    <TextField
      value={text}
      title="Имя беседы"
      disabled={pending}
      onInput={value => {setText(value); setError("")}}
      style={css`
        width: 100%;
        min-width: 0;
      `}
    />
    <div style={css`
      display: flex;
      flex-direction: row;
      gap: 4px;
    `}>
      <Button label="Сохранить" disabled={pending} onClick={() => {void save()}} />
      <Button label="Отмена" disabled={pending} onClick={props.onCancel} />
    </div>
    <p hidden={error.length === 0} role="alert" style={css`
      margin: 0;
      &[hidden] {
        display: none;
      }
    `}>{error}</p>
  </div>
}
