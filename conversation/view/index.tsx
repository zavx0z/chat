/**
Поверхность беседы отделяет сообщения и поле ввода от окружающего приложения.
Содержимое и действия передаются слотами в тот же semantic Document.
*/
import type {JSX} from "@zavx0z/immersive/XReact"

export default function ConversationSurface(props: Readonly<{label: string}>): JSX.Element {
  return <section
    data-conversation-surface=""
    aria-label={props.label}
    style={css`
      box-sizing: border-box;
      position: relative;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      gap: 12px;
      padding: 12px;
      overflow: hidden;
      background: rgb(var(--surface-950));
      color: var(--widget-regular-content);
      font-size: 14px;
      line-height: 1.5;
    `}
  >
    <slot />
  </section>
}
