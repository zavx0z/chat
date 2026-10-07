import MessageView, {ImagePreview, type MediaPreview} from "../index"

export default function ImageVisibilityFixture(props: Readonly<{media: readonly MediaPreview[], nested: boolean, markdown?: boolean}>) {
  return <div
    data-chat-messages=""
    data-outer-viewport=""
    style={css`
      display: flex;
      flex-direction: column;
      width: 360px;
      height: 320px;
      overflow: auto;
    `}
  >
    <div style={css`
      flex-shrink: 0;
      width: 100%;
    `}>
      {props.nested ? <NestedMediaRows
        media={props.media}
        markdown={props.markdown === true}
      /> : <MediaRows
        media={props.media}
        markdown={props.markdown === true}
      />}
      <div style={css`
        height: 900px;
      `} />
    </div>
  </div>
}

function MediaRows(props: Readonly<{media: readonly MediaPreview[], markdown: boolean}>) {
  return <div>
    {props.media.map((media, index) => <MediaRow
      key={String(index)}
      id={`m${index}`}
      media={media}
      markdown={props.markdown}
    />)}
  </div>
}

function NestedMediaRows(props: Readonly<{media: readonly MediaPreview[], markdown: boolean}>) {
  return <div
    data-chat-messages=""
    style={css`
      width: 100%;
      height: 220px;
      overflow: auto;
    `}
  >
    <MediaRows media={props.media} markdown={props.markdown} />
  </div>
}

function MediaRow(props: Readonly<{id: string, media: MediaPreview, markdown: boolean}>) {
  return <article
    data-conversation-message={props.id}
    style={css`
      min-height: 220px;
    `}
  >
    {props.markdown ? <MarkdownImageRow media={props.media} /> : <ImagePreview media={props.media} />}
  </article>
}

function MarkdownImageRow(props: Readonly<{media: MediaPreview}>) {
  const text = `Начало **жирный** ![${props.media.label}](${String(props.media.source)}) конец [ссылка](https://example.com/source)`
  return <MessageView
    content={{type: "text", text}}
  />
}
