import {expect, test} from "bun:test"
import {createRoot} from "@zavx0z/immersive-component"
import {createDocument, ClipboardEvent, DataTransfer, DragEvent, releaseDataTransfer, type HTMLButtonElement} from "@zavx0z/immersive-dom"
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
    const paste = new ClipboardEvent("paste", {bubbles: true, cancelable: true, clipboardData: new DataTransfer({files: [file]})})
    input.dispatchEvent(paste)
    expect(paste.defaultPrevented).toBe(true)
    expect(received).toEqual([[file], [file]])
    props = {...props, busy: true}
    render()
    const blocked = new DragEvent("drop", {bubbles: true, cancelable: true, dataTransfer: new DataTransfer({files: [file]})})
    host.querySelector("textarea")!.dispatchEvent(blocked)
    expect(blocked.defaultPrevented).toBe(true)
    expect(received).toHaveLength(2)
  } finally {root.unmount();renderer.dispose()}
})

test("draft во время ответа отправляется отдельной кнопкой, stop остаётся доступным", () => {
  const document = createDocument()
  const host = document.createElement("div")
  document.append(host)
  const root = createRoot(host)
  let sent = 0
  let stopped = 0
  const props: ChatMessageComposer.Input = {draft: "Следующее сообщение", busy: false, canCancel: true, sendLabel: "Добавить в очередь",
    onDraftChange() {}, onSend() {sent++}, onCancel() {stopped++}}
  try {
    root.render(Composer as unknown as CompiledTemplate<ChatMessageComposer.Input>, props)
    root.flush()
    const send = host.querySelector('button[aria-label="Добавить в очередь"]') as HTMLButtonElement
    const stop = host.querySelector('button[aria-label="Остановить"]') as HTMLButtonElement
    expect(send).not.toBeNull()
    expect(stop).not.toBeNull()
    send.click()
    expect([sent, stopped]).toEqual([1, 0])
    stop.click()
    expect([sent, stopped]).toEqual([1, 1])
  } finally {root.unmount()}
})
