import {expect, test} from "bun:test"
import {component, provideContext, createRoot} from "@zavx0z/immersive-component"
import {createDocument, type HTMLElement} from "@zavx0z/immersive-dom"
import {flushDocumentLayoutObservers} from "@zavx0z/immersive-dom/geometry"
import {createDocumentRenderer} from "@zavx0z/immersive-renderer-html"
import type {CompiledTemplate} from "@zavx0z/immersive-template/compiled"
import {createMediaImageCache} from "../../../media/browser"
import {MediaHostContext, type MediaHost, type MediaPreview} from "../index"
import Fixture from "./image-visibility-fixture"

/** Подменены только native decode/encode; geometry, scroll, refs и Component lifecycle настоящие. */
function preparation() {
  const keys = ["createImageBitmap", "OffscreenCanvas"] as const
  const originals = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key))
  let decodes = 0
  let closes = 0
  Object.defineProperty(globalThis, keys[0], {configurable: true, value: async () => {
    decodes++
    return {width: 512, height: 320, close() {closes++}}
  }})
  class Canvas {
    constructor(public width: number, public height: number) {}
    getContext() {return {drawImage() {}}}
    async convertToBlob() {return new Blob([new Uint8Array(8)], {type: "image/webp"})}
  }
  Object.defineProperty(globalThis, keys[1], {configurable: true, value: Canvas})
  return {
    get decodes() {return decodes},
    get closes() {return closes},
    restore() {keys.forEach((key, index) => {
      const original = originals[index]
      if (original) Object.defineProperty(globalThis, key, original)
      else Reflect.deleteProperty(globalThis, key)
    })},
  }
}

async function fixture(nested: boolean, count = 3, delayed = false) {
  const native = preparation()
  const document = createDocument()
  const host = document.createElement("div")
  document.append(host)
  const root = createRoot(host)
  const cache = createMediaImageCache()
  let originals = 0
  const loadedSignals: AbortSignal[] = []
  const originalGate = Promise.withResolvers<void>()
  const mediaHost: MediaHost = {
    images: cache,
    async load(_source, signal) {
      signal.throwIfAborted()
      originals++
      loadedSignals.push(signal)
      if (delayed) await originalGate.promise
      return new Blob([new Uint8Array(128)], {type: "image/png"})
    },
    async download() {},
  }
  const media: MediaPreview[] = Array.from({length: count}, (_, index) => ({source: "https://example.com/shared.png", mimeType: "image/png", label: `Фото ${index}`}))
  const props = {media, nested}
  root.render(provideContext(MediaHostContext, mediaHost, component(Fixture as unknown as CompiledTemplate<typeof props>, props)))
  const imageSignals: AbortSignal[] = []
  const renderer = createDocumentRenderer({document, root: host, viewport: {width: 360, height: 320},
    imageMeasurer: {measureImage(_source, signal) {if (signal) imageSignals.push(signal); return null}},
  })
  const settle = async () => {
    for (let round = 0; round < 12; round++) {
      root.flush()
      renderer.flush()
      flushDocumentLayoutObservers(document)
      await Bun.sleep(0)
    }
  }
  return {
    host, cache, native, imageSignals, loadedSignals, settle,
    releaseOriginal() {originalGate.resolve()},
    get originals() {return originals},
    outer() {return host.querySelector("[data-outer-viewport]") as HTMLElement},
    dispose() {root.unmount(); renderer.dispose(); cache.dispose(); native.restore()},
  }
}

test("scroll освобождает thumbnail leases без демонтажа article/img и возврат использует один encoded вариант без original decode", async () => {
  const f = await fixture(false)
  try {
    await f.settle()
    expect(f.originals).toBe(1)
    expect(f.native.decodes).toBe(1)
    expect(f.native.closes).toBe(1)
    expect(f.cache.inspect()).toMatchObject({entries: 1, bytes: 8, activeLeases: 2, uncachedBytes: 0})
    const articles = [...f.host.querySelectorAll("article")]
    const images = [...f.host.querySelectorAll("img")]
    expect(images).toHaveLength(2)
    const firstHeight = articles[0]!.getLayoutRect()!.height
    const firstImageBox = images[0]!.getLayoutRect()!
    const signals = [...f.imageSignals]
    for (let cycle = 0; cycle < 3; cycle++) {
      f.outer().scrollTop = 800
      await f.settle()
      expect(f.cache.inspect().activeLeases).toBe(0)
      expect(f.cache.inspect().uncachedBytes).toBe(0)
      expect(f.host.querySelectorAll("img[src]")).toHaveLength(0)
      expect([...f.host.querySelectorAll("article")]).toEqual(articles)
      expect([...f.host.querySelectorAll("img")]).toEqual(images)
      expect(articles[0]!.getLayoutRect()!.height).toBe(firstHeight)
      expect(images[0]!.getLayoutRect()!.height).toBe(firstImageBox.height)
      f.outer().scrollTop = 0
      await f.settle()
      expect(f.cache.inspect().activeLeases).toBe(2)
      expect(f.originals).toBe(1)
      expect(f.native.decodes).toBe(1)
      expect(f.native.closes).toBe(1)
      expect([...f.host.querySelectorAll("img")]).toEqual(images)
    }
    expect(signals.length).toBeGreaterThan(0)
    expect(signals.every(signal => signal.aborted)).toBeTrue()
  } finally {f.dispose()}
  expect(f.cache.inspect()).toMatchObject({entries: 0, activeLeases: 0, bytes: 0, retiredBytes: 0, uncachedBytes: 0})
})

test("вложенное изображение освобождает lease при scroll outer, хотя inner по-прежнему видит свою строку", async () => {
  const f = await fixture(true, 1)
  try {
    await f.settle()
    expect(f.cache.inspect().activeLeases).toBe(1)
    f.outer().scrollTop = 400
    await f.settle()
    expect(f.cache.inspect().activeLeases).toBe(0)
    expect(f.host.querySelector("img")!.hasAttribute("src")).toBeFalse()
    f.outer().scrollTop = 0
    await f.settle()
    expect(f.cache.inspect().activeLeases).toBe(1)
    expect(f.originals).toBe(1)
    expect(f.native.decodes).toBe(1)
  } finally {f.dispose()}
})


test("уход за экран отменяет ожидающий loader и поздний original не вызывает decode или новый lease", async () => {
  const f = await fixture(false, 1, true)
  try {
    await f.settle()
    expect(f.originals).toBe(1)
    expect(f.native.decodes).toBe(0)
    expect(f.loadedSignals[0]!.aborted).toBeFalse()
    f.outer().scrollTop = 600
    await f.settle()
    expect(f.loadedSignals[0]!.aborted).toBeTrue()
    f.releaseOriginal()
    await f.settle()
    expect(f.native.decodes).toBe(0)
    expect(f.host.querySelector("img")).toBeNull()
    expect(f.cache.inspect()).toMatchObject({entries: 0, activeLeases: 0, retiredBytes: 0, uncachedBytes: 0})
  } finally {f.releaseOriginal(); f.dispose()}
})
