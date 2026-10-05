import {expect, test} from "bun:test"
import {createRoot} from "@zavx0z/immersive-component"
import {createDocument, DataTransfer, DragEvent, releaseDataTransfer, type HTMLButtonElement} from "@zavx0z/immersive-dom"
import {createDocumentRenderer} from "@zavx0z/immersive-renderer-html"
import type {CompiledTemplate} from "@zavx0z/immersive-template/compiled"
import Composer, {type ChatMessageComposer} from "../index"

test("IconButton вложения и файловый drop на textarea используют общие callbacks без отправки сообщения", async () => {
  const document = createDocument()
  const host = document.createElement("div")
  document.append(host)
  const root = createRoot(host)
  const renderer = createDocumentRenderer({document, root: host, viewport: {width: 360, height: 400}})
  const received: (readonly File[])[] = []
  let picked = 0
  let sent = 0
  let props: ChatMessageComposer.Input = {draft: "Черновик", busy: false, onDraftChange() {}, onCancel() {},
    onSend() {sent++}, onAttach() {picked++}, onFiles(files) {received.push(files)}}
  const render = () => {root.render(Composer as unknown as CompiledTemplate<ChatMessageComposer.Input>, props);root.flush();renderer.flush()}
  try {
    render()
    const button = host.querySelector('button[aria-label="Прикрепить файл"]') as HTMLButtonElement
    expect(button.getAttribute("data-variant")).toBe("text")
    expect(button.getAttribute("data-icon-only")).toBe("true")
    expect(button.getLayoutRect()!.width).toBe(32)
    button.click()
    expect(picked).toBe(1)
    const input = host.querySelector("textarea")!
    const hoverTransfer = new DataTransfer({types: ["Files"]})
    const over = new DragEvent("dragover", {bubbles: true, cancelable: true, dataTransfer: hoverTransfer})
    input.dispatchEvent(over)
    expect(over.defaultPrevented).toBe(true)
    expect(hoverTransfer.dropEffect).toBe("copy")
    const file = new File(["Текст"], "Заметка.txt", {type: "text/plain"})
    const transfer = new DataTransfer({files: [file]})
    const drop = new DragEvent("drop", {bubbles: true, cancelable: true, dataTransfer: transfer})
    input.dispatchEvent(drop)
    releaseDataTransfer(transfer)
    expect(drop.defaultPrevented).toBe(true)
    expect(transfer.files).toHaveLength(0)
    expect(received).toEqual([[file]])
    expect(await received[0]![0]!.text()).toBe("Текст")
    expect(sent).toBe(0)
    props = {...props, busy: true}
    render()
    const blocked = new DragEvent("drop", {bubbles: true, cancelable: true, dataTransfer: new DataTransfer({files: [file]})})
    host.querySelector("textarea")!.dispatchEvent(blocked)
    expect(blocked.defaultPrevented).toBe(true)
    expect(received).toHaveLength(1)
  } finally {root.unmount();renderer.dispose()}
})
