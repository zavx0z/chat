import {expect, test} from "bun:test"
import {createRoot} from "@zavx0z/immersive/XReact"
import {createDocument, type HTMLButtonElement} from "@zavx0z/immersive"
import {createDocumentRenderer} from "@zavx0z/immersive/renderer/html"
import type {CompiledTemplate} from "@zavx0z/immersive/XReact/compiled"
import Composer, {type ChatMessageComposer} from "../index"

/** Controlled host processing: layout test требует восемь готовых preview, не notices. */
function imageHost() {
  const keys = ["createImageBitmap", "OffscreenCanvas"] as const
  const old = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key))
  Object.defineProperty(globalThis, keys[0], {configurable: true, value: async () => ({width: 4000, height: 3000, close() {}})})
  class Canvas {
    constructor(public width: number, public height: number) {}
    getContext() {return {drawImage() {}}}
    async convertToBlob() {return new Blob([new Uint8Array([1])], {type: "image/png"})}
  }
  Object.defineProperty(globalThis, keys[1], {configurable: true, value: Canvas})
  return () => keys.forEach((key, index) => {
    const previous = old[index]
    if (previous) Object.defineProperty(globalThis, key, previous)
    else Reflect.deleteProperty(globalThis, key)
  })
}

test("восемь preview с длинными именами занимают bounded horizontal strip и сохраняют input/send в viewport", async () => {
  const restore = imageHost()
  const document = createDocument()
  const host = document.createElement("div")
  document.append(host)
  const root = createRoot(host)
  const sent: string[] = []
  const removed: string[] = []
  const props: ChatMessageComposer.Input = {draft: "Сообщение", busy: false,
    attachments: Array.from({length: 8}, (_, index) => ({attachment: {id: `image-${index}`, name: `Очень длинное имя фотографии ${index} `.repeat(8) + ".png", kind: "image", mimeType: "image/png", bytes: 1, data: "AQ=="}, release() {}})),
    onDraftChange() {}, onSend() {sent.push("sent")}, onCancel() {}, onRemove(id) {removed.push(id)},
  }
  const renderer = createDocumentRenderer({document, root: host, viewport: {width: 360, height: 600},
    imageMeasurer: {measureImage: () => ({width: 512, height: 384})},
  })
  try {
    root.render(Composer as unknown as CompiledTemplate<ChatMessageComposer.Input>, props)
    for (let round = 0; round < 12; round++) {await Bun.sleep(0); root.flush(); renderer.flush()}
    const strip = host.querySelector("[data-chat-attachment-strip]")!
    const cards = [...host.querySelectorAll("[data-chat-draft-attachment]")]
    expect(cards).toHaveLength(8)
    expect(host.querySelectorAll("[data-chat-image]")).toHaveLength(8)
    const box = strip.getLayoutRect()!
    expect(box.height).toBeLessThanOrEqual(160)
    expect(box.width).toBeLessThanOrEqual(360)
    const first = cards[0]!.getLayoutRect(strip)!
    const last = cards.at(-1)!.getLayoutRect(strip)!
    expect(first.width).toBeLessThanOrEqual(132)
    expect(last.top).toBe(first.top)
    expect(last.left).toBeGreaterThan(box.width)
    const input = host.querySelector("textarea")!
    const send = host.querySelector('button[aria-label="Отправить"]') as HTMLButtonElement
    expect(input.getLayoutRect()!.bottom).toBeLessThanOrEqual(600)
    expect(send.getLayoutRect()!.bottom).toBeLessThanOrEqual(600)
    expect(send.getLayoutRect()!.top).toBeGreaterThanOrEqual(input.getLayoutRect()!.bottom)
    send.click()
    expect(sent).toEqual(["sent"])
    const remove = cards[0]!.querySelector('button[aria-label="Удалить вложение"]') as HTMLButtonElement
    remove.click()
    expect(removed).toEqual(["image-0"])
  } finally {root.unmount(); renderer.dispose(); restore()}
})
