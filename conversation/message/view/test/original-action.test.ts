import {expect, test} from "bun:test"
import {component, provideContext, createRoot} from "@zavx0z/immersive/XReact"
import {createDocument, type HTMLButtonElement} from "@zavx0z/immersive"
import type {CompiledTemplate} from "@zavx0z/immersive/XReact/compiled"
import {MediaOverlay, MediaHostContext, type MediaHost, type MediaPreview} from "../index"

function fixture(openOriginal?: MediaHost["openOriginal"]) {
  const document = createDocument()
  const container = document.createElement("div")
  document.append(container)
  const root = createRoot(container)
  const media: MediaPreview = {source: "chat-media:original", mimeType: "image/png", label: "Изображение"}
  const host: MediaHost = {async load() {throw new Error("Без geometry provider preview не загружается")}, async download() {},
    ...(openOriginal ? {openOriginal} : {}),
  }
  const props = {media, onClose() {}}
  root.render(provideContext(MediaHostContext, host, component(MediaOverlay as unknown as CompiledTemplate<typeof props>, props)))
  return {root, container, media,
    button() {return [...container.querySelectorAll("button")].find(button => button.textContent === "Открыть оригинал") as HTMLButtonElement | undefined},
    async settle() {for (let round = 0; round < 3; round++) {root.flush(); await Bun.sleep(0)}},
    dispose() {root.unmount()},
  }
}

test("требование пользователя: overlay предоставляет Открыть оригинал отдельно от download, быстрый повтор не открывает две вкладки", async () => {
  const gate = Promise.withResolvers<void>()
  const calls: {media: MediaPreview, signal: AbortSignal}[] = []
  const f = fixture((media, signal) => {calls.push({media, signal}); return gate.promise})
  try {
    await f.settle()
    const original = f.button()!
    expect(original).toBeDefined()
    expect([...f.container.querySelectorAll("button")].some(button => button.textContent === "Скачать оригинал")).toBeTrue()
    original.click()
    original.click()
    expect(calls).toHaveLength(1)
    expect(calls[0]!.media).toBe(f.media)
    await f.settle()
    expect(original.disabled).toBeTrue()
    gate.resolve()
    await f.settle()
    expect(original.disabled).toBeFalse()
  } finally {f.dispose()}
  expect(calls[0]!.signal.aborted).toBeFalse()
})

test("закрытие overlay отменяет только pending original operation", async () => {
  const gate = Promise.withResolvers<void>()
  let signal: AbortSignal | undefined
  const f = fixture((_media, value) => {signal = value; return gate.promise})
  await f.settle()
  f.button()!.click()
  f.dispose()
  expect(signal!.aborted).toBeTrue()
  gate.resolve()
  await Bun.sleep(0)
})

test("ошибка host доступна для явного retry; capability отсутствие не изображается рабочей кнопкой", async () => {
  let calls = 0
  const f = fixture(() => {calls++; throw new Error("Новая вкладка заблокирована")})
  try {
    await f.settle()
    f.button()!.click()
    await f.settle()
    expect(f.container.textContent).toContain("Новая вкладка заблокирована")
    expect(f.button()!.disabled).toBeFalse()
    f.button()!.click()
    expect(calls).toBe(2)
  } finally {f.dispose()}
  const unsupported = fixture()
  try {await unsupported.settle(); expect(unsupported.button()).toBeUndefined()}
  finally {unsupported.dispose()}
})
