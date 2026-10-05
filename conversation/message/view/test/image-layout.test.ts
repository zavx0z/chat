import {expect, test} from "bun:test"
import {createRoot} from "@zavx0z/immersive-component"
import {createDocument, type HTMLImageElement, type HTMLButtonElement} from "@zavx0z/immersive-dom"
import {createDocumentRenderer, createDocumentInteractionController, hitTestProjection} from "@zavx0z/immersive-renderer-html"
import type {CompiledTemplate} from "@zavx0z/immersive-template/compiled"
import {ImagePreview, MediaOverlay, type MediaPreview} from "../index"

/** Host processor контролирует только готовый raster; Component/DOM/layout/hit testing настоящие. */
function imageHost() {
  const keys = ["createImageBitmap", "OffscreenCanvas"] as const
  const old = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key))
  Object.defineProperty(globalThis, keys[0], {configurable: true, value: async () => ({width: 1600, height: 1000, close() {}})})
  class Canvas {
    constructor(public width: number, public height: number) {}
    getContext() { return {drawImage() {}} }
    async convertToBlob() { return new Blob([new Uint8Array([1])], {type: "image/png"}) }
  }
  Object.defineProperty(globalThis, keys[1], {configurable: true, value: Canvas})
  return () => keys.forEach((key, index) => {
    const previous = old[index]
    if (previous) Object.defineProperty(globalThis, key, previous)
    else Reflect.deleteProperty(globalThis, key)
  })
}

test("готовый 512×320 thumbnail имеет геометрию и click hit до загрузки intrinsic metrics; overlay использует тот же Document", async () => {
  const restore = imageHost()
  const document = createDocument()
  const host = document.createElement("div")
  host.setAttribute("style", "position:relative;width:354px;height:600px")
  document.append(host)
  const root = createRoot(host)
  const renderer = createDocumentRenderer({document, root: host, viewport: {width: 354, height: 600},
    imageMeasurer: {measureImage() { return null }},
  })
  const interaction = createDocumentInteractionController({document})
  const opened: MediaPreview[] = []
  const media: MediaPreview = {source: {id: "known", name: "Фото", kind: "image", mimeType: "image/png", bytes: 1, data: "AQ=="}, label: "Фото", mimeType: "image/png"}
  const previewProps = {media, onMedia: (value: MediaPreview) => {opened.push(value)}}
  const tick = async () => {
    for (let round = 0; round < 12; round++) {
      await Bun.sleep(0)
      root.flush()
      renderer.flush()
    }
  }
  try {
    root.render(ImagePreview as unknown as CompiledTemplate<typeof previewProps>, previewProps)
    await tick()
    const image = host.querySelector("[data-chat-image]") as HTMLImageElement
    expect(image).not.toBeNull()
    expect(image.width).toBe(512)
    expect(image.height).toBe(320)
    const button = image.parentElement as HTMLButtonElement
    const box = image.getLayoutRect()!
    const bounds = image.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    expect(box.width).toBeLessThanOrEqual(354)
    expect(box.height).toBeLessThanOrEqual(200)
    expect(bounds.width).toBe(box.width)
    expect(bounds.height).toBe(box.height)
    expect(button.getLayoutRect()!.width).toBeGreaterThan(0)
    expect(button.getLayoutRect()!.height).toBeGreaterThan(0)
    expect(image.src).toStartWith("blob:")
    const frame = renderer.flush()
    const x = box.left + box.width / 2
    const y = box.top + box.height / 2
    expect(button.contains(hitTestProjection(frame, x, y)!.node)).toBeTrue()
    interaction.pointerDown(frame, {clientX: x, clientY: y})
    interaction.pointerUp(frame, {clientX: x, clientY: y})
    expect(opened).toEqual([media])
    const overlayProps = {media: opened[0]!, onClose() {}}
    root.render(MediaOverlay as unknown as CompiledTemplate<typeof overlayProps>, overlayProps)
    await tick()
    const dialog = host.querySelector("[data-chat-media-overlay]")!
    const full = dialog.querySelector("[data-chat-full-image]") as HTMLImageElement
    expect(full).not.toBeNull()
    expect(full.ownerDocument).toBe(document)
    expect(full.width).toBeGreaterThan(0)
    expect(full.height).toBeGreaterThan(0)
    const fullBox = full.getLayoutRect()
    expect(fullBox).not.toBeNull()
    expect(fullBox!.width).toBeGreaterThan(0)
    expect(full.getLayoutRect()!.height).toBeGreaterThan(0)
    expect(full.src).toStartWith("blob:")
  } finally {
    root.unmount()
    interaction.dispose()
    renderer.dispose()
    restore()
  }
})
