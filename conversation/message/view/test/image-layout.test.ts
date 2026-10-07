import {expect, test} from "bun:test"
import {component, provideContext, createRoot} from "@zavx0z/immersive-component"
import {createDocument, InputEvent, type HTMLInputElement, type HTMLImageElement, type HTMLButtonElement} from "@zavx0z/immersive-dom"
import {createDocumentRenderer, createDocumentInteractionController, hitTestProjection} from "@zavx0z/immersive-renderer-html"
import type {CompiledTemplate} from "@zavx0z/immersive-template/compiled"
import MessageView, {ImagePreview, MediaOverlay, MediaHostContext, type MediaHost, type MediaPreview} from "../index"

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


test("Markdown external image показывает ошибку, retry загружает thumbnail, click открывает исходный URL", async () => {
  const restore = imageHost()
  const document = createDocument()
  const container = document.createElement("div")
  document.append(container)
  const root = createRoot(container)
  const opened: MediaPreview[] = []
  let attempts = 0
  const host: MediaHost = {async load(_source, signal) {
    signal.throwIfAborted()
    if (++attempts === 1) throw new Error("HTTP 404")
    return new Blob([new Uint8Array([1])], {type: "image/png"})
  }, async download() {}}
  const props = {content: {type: "text" as const, text: "![Логотип](https://example.com/logo.png)"}, onMedia: (media: MediaPreview) => opened.push(media)}
  const tick = async () => {for (let i = 0; i < 8; i++) {await Bun.sleep(0); root.flush()}}
  try {
    root.render(provideContext(MediaHostContext, host, component(MessageView as unknown as CompiledTemplate<typeof props>, props)))
    await tick()
    expect(container.textContent).toContain("HTTP 404")
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("HTTP 404")
    expect(container.querySelector('img[alt="Логотип"]')).toBeNull()
    const retry = [...container.querySelectorAll("button")].find(button => button.textContent === "Повторить загрузку") as HTMLButtonElement
    retry.click()
    await tick()
    expect(container.querySelector('img[alt="Логотип"]')?.getAttribute("src")).toStartWith("blob:")
    const open = container.querySelector('button[aria-label="Открыть: Логотип"]') as HTMLButtonElement
    open.click()
    expect(opened[0]?.source).toBe("https://example.com/logo.png")
    expect(attempts).toBe(2)
  } finally {root.unmount(); restore()}
})

test("non-image overlay предоставляет download и не вызывает image decoder", async () => {
  const document = createDocument()
  const container = document.createElement("div")
  document.append(container)
  const root = createRoot(container)
  const downloads: string[] = []
  const host: MediaHost = {async load() {throw new Error("Не должен загружаться как image")}, async download(media) {downloads.push(media.label)}}
  const props = {media: {source: "chat-media:sample", mimeType: "application/pdf", label: "report.pdf"}, onClose() {}}
  try {
    root.render(provideContext(MediaHostContext, host, component(MediaOverlay as unknown as CompiledTemplate<typeof props>, props)))
    root.flush()
    expect(container.textContent).toContain("report.pdf")
    const button = [...container.querySelectorAll("button")].find(button => button.textContent === "Скачать оригинал") as HTMLButtonElement
    button.click()
    await Bun.sleep(0)
    root.flush()
    expect(downloads).toEqual(["report.pdf"])
    expect(container.textContent).not.toContain("источник изображения")
  } finally {root.unmount()}
})

test("audio overlay управляет host playback и освобождает его при закрытии", async () => {
  const document = createDocument()
  const container = document.createElement("div")
  document.append(container)
  const root = createRoot(container)
  let plays = 0
  let pauses = 0
  let disposals = 0
  const seeks: number[] = []
  const host: MediaHost = {
    async load() {return new Blob([new Uint8Array([1])], {type: "audio/mpeg"})},
    async download() {},
    createAudio(_blob, changed) {
      return {
        async play() {plays++; changed({playing: true, currentTime: 1, duration: 10, error: null})},
        pause() {pauses++; changed({playing: false, currentTime: 1, duration: 10, error: null})},
        seek(value) {seeks.push(value)},
        dispose() {disposals++},
      }
    },
  }
  const props = {media: {source: "chat-media:audio", mimeType: "audio/mpeg", label: "voice.mp3"}, onClose() {}}
  try {
    root.render(provideContext(MediaHostContext, host, component(MediaOverlay as unknown as CompiledTemplate<typeof props>, props)))
    for (let i = 0; i < 5; i++) {await Bun.sleep(0); root.flush()}
    const button = [...container.querySelectorAll("button")].find(button => button.textContent === "Воспроизвести") as HTMLButtonElement
    button.click()
    await Bun.sleep(0)
    root.flush()
    expect(plays).toBe(1)
    expect(container.textContent).toContain("Пауза")
    const slider = container.querySelector("input[data-slider-field-value]") as HTMLInputElement
    expect(slider).not.toBeNull()
    expect(slider.disabled).toBe(false)
    slider.value = "4.5"
    slider.dispatchEvent(new InputEvent("input", {bubbles: true}))
    expect(seeks).toEqual([4.5])
    const pause = [...container.querySelectorAll("button")].find(button => button.textContent === "Пауза") as HTMLButtonElement
    pause.click()
    root.flush()
    expect(pauses).toBe(1)
  } finally {root.unmount()}
  expect(disposals).toBe(1)
})


function relativeLuminance(color: string): number {
  const hex = /^#([a-f0-9]{6})$/iu.exec(color)
  const channels = hex ? [0, 2, 4].map(index => Number.parseInt(hex[1]!.slice(index, index + 2), 16))
    : /^rgba?\(/u.test(color) ? (color.match(/[\d.]+/gu) ?? []).slice(0, 3).map(Number) : []
  if (channels.length !== 3) throw new Error(`Unknown rendered color: ${color}`)
  const linear = channels.map(value => value / 255 <= 0.04045 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4)
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722
}

test("Markdown Retry использует реальную тему Button с читаемым контрастом; chat links сохраняют текущую вкладку", async () => {
  const restore = imageHost()
  const document = createDocument()
  const container = document.createElement("div")
  container.setAttribute("style", "width:360px;height:400px;background:rgb(48 48 48)")
  document.append(container)
  const root = createRoot(container)
  const renderer = createDocumentRenderer({document, root: container, viewport: {width: 360, height: 400},
    styleSheets: [await Bun.file(Bun.resolveSync("@zavx0z/immersive-ui-component/theme/theme.css", import.meta.dir)).text()],
  })
  const host: MediaHost = {async load() {throw new Error("HTTP 404")}, async download() {}}
  const props = {content: {type: "text" as const, text: "![Ошибка](https://example.com/missing.png)\n\n[Открыть источник](https://example.com/source)"}}
  try {
    root.render(provideContext(MediaHostContext, host, component(MessageView as unknown as CompiledTemplate<typeof props>, props)))
    for (let index = 0; index < 8; index++) {await Bun.sleep(0); root.flush(); renderer.flush()}
    const retry = [...container.querySelectorAll("button")].find(button => button.textContent === "Повторить загрузку")!
    expect(retry.getAttribute("data-variant")).toBe("contained")
    expect(retry.getLayoutRect()!.height).toBeGreaterThan(0)
    const frame = renderer.flush()
    const text = frame.displayList.find(item => item.kind === "text" && item.text.includes("Повторить") && retry.contains(item.node))!
    const background = frame.displayList.find(item => item.kind === "rect" && item.node === retry && item.color !== "transparent")!
    if (text?.kind !== "text" || background?.kind !== "rect") throw new Error("Retry must have actual text and background paint")
    const light = relativeLuminance(text.color)
    const dark = relativeLuminance(background.color)
    expect((Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05)).toBeGreaterThanOrEqual(4.5)
    const link = container.querySelector("a")!
    expect(link.getAttribute("href")).toBe("https://example.com/source")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toContain("noreferrer")
  } finally {root.unmount(); renderer.dispose(); restore()}
})
