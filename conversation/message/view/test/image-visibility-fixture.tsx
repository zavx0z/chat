import {ImagePreview, type MediaPreview} from "../index"

export default function ImageVisibilityFixture(props: Readonly<{media: readonly MediaPreview[], nested: boolean}>) {
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
      {props.nested ? <NestedMediaRows media={props.media} /> : <MediaRows media={props.media} />}
      <div style={css`
        height: 900px;
      `} />
    </div>
  </div>
}

function MediaRows(props: Readonly<{media: readonly MediaPreview[]}>) {
  return <div>
    {props.media.map((media, index) => <MediaRow
      key={String(index)}
      id={`m${index}`}
      media={media}
    />)}
  </div>
}

function NestedMediaRows(props: Readonly<{media: readonly MediaPreview[]}>) {
  return <div
    data-chat-messages=""
    style={css`
      width: 100%;
      height: 220px;
      overflow: auto;
    `}
  >
    <MediaRows media={props.media} />
  </div>
}

function MediaRow(props: Readonly<{id: string, media: MediaPreview}>) {
  return <article
    data-conversation-message={props.id}
    style={css`
      min-height: 220px;
    `}
  >
    <ImagePreview media={props.media} />
  </article>
}
