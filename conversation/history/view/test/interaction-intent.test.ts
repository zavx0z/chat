import {expect, test} from "bun:test"
import {createRoot} from "@zavx0z/immersive-component"
import {createDocument, Event, KeyboardEvent, type HTMLElement} from "@zavx0z/immersive-dom"
import {flushDocumentLayoutObservers} from "@zavx0z/immersive-dom/geometry"
import {createDocumentRenderer, createDocumentInteractionController} from "@zavx0z/immersive-renderer-html"
import type {CompiledTemplate} from "@zavx0z/immersive-template/compiled"
import Fixture, {type Props} from "./interaction-intent-fixture"

async function fixture() {
  const document = createDocument()
  const host = document.createElement("div")
  document.append(host)
  const root = createRoot(host)
  const theme = await Bun.file(new URL(import.meta.resolve("@zavx0z/immersive-ui-component/theme/theme.css"))).text()
  const renderer = createDocumentRenderer({document, root: host, viewport: {width: 360, height: 320}, styleSheets: [theme]})
  const input = createDocumentInteractionController({document})
  let dirty = true
  let expanded = false
  let assistantHeight = 240
  let following = true
  let innerFollowing = true
  let outerReports = 0
  const outerRows = ["past", "group", "assistant"].map(id => ({header: {id}}))
  const innerRows = Array.from({length: 16}, (_, i) => ({header: {id: `event:${i}`}}))
  const render = () => {
    root.render(Fixture as unknown as CompiledTemplate<Props>, {
      expanded, assistantHeight,
      outer: {rows: [...outerRows], total: 3, following, after: null, unread: 0, loading: false},
      inner: {rows: [...innerRows], total: 16, following: innerFollowing, after: null, unread: 0, loading: false},
      onToggle(value) {expanded = value; dirty = true},
      onOuterViewport(value) {outerReports++; if (following !== value.following) {following = value.following; dirty = true}},
      onInnerViewport(value) {if (innerFollowing !== value.following) {innerFollowing = value.following; dirty = true}},
    })
  }
  const settle = async () => {
    for (let i = 0; i < 12; i++) {
      if (dirty) {dirty = false; render()}
      root.flush(); renderer.flush(); flushDocumentLayoutObservers(document)
      await Bun.sleep(0)
    }
  }
  const outer = () => host.querySelectorAll("[data-chat-messages]")[0] as HTMLElement
  const group = () => host.querySelector('[data-chat-history-id="group"]') as HTMLElement
  const button = () => group().querySelector('[aria-expanded]')!
  return {host, renderer, input, settle, outer, group, button,
    get following() {return following}, get reports() {return outerReports},
    adjustAssistant(delta: number) {assistantHeight += delta; dirty = true},
    rerender() {dirty = true},
    dispose() {input.dispose(); root.unmount(); renderer.dispose()},
  }
}

test.each(["pointer", "Enter", " "])("%s удерживает частично видимый clicked group header, а не assistant ниже", async mode => {
  const f = await fixture()
  try {
    await f.settle()
    expect(f.following).toBeTrue()
    // Геометрия задаёт fixture; scrollTop вручную не меняется.
    const top = f.group().getLayoutRect(f.outer())!.top
    f.adjustAssistant(top + 8)
    await f.settle()
    const before = f.group().getLayoutRect(f.outer())!.top
    expect(before).toBeLessThan(0)
    expect(before).toBeGreaterThan(-26)
    const button = f.button()
    if (mode === "pointer") button.dispatchEvent(new Event("pointerdown", {bubbles: true}))
    else button.dispatchEvent(new KeyboardEvent("keydown", {key: mode, bubbles: true}))
    // Между pointerdown и активацией может прийти обычная перерисовка/stream update.
    f.rerender()
    await f.settle()
    if (button.getAttribute("aria-expanded") !== "true") button.dispatchEvent(new Event("click", {bubbles: true}))
    await f.settle()
    expect(f.group().getLayoutRect()!.height).toBeGreaterThan(300)
    expect(Math.abs(f.group().getLayoutRect(f.outer())!.top - before)).toBeLessThanOrEqual(1)
    expect(f.following).toBeFalse()
  } finally {f.dispose()}
})

test("nested wheel/key не оставляют outer pending epoch; реальная scroll chain остаётся доступной", async () => {
  const f = await fixture()
  try {
    await f.settle()
    const button = f.button()
    button.dispatchEvent(new Event("pointerdown", {bubbles: true}))
    button.dispatchEvent(new Event("click", {bubbles: true}))
    await f.settle()
    const inner = f.host.querySelectorAll("[data-chat-messages]")[1] as HTMLElement
    const rect = inner.getLayoutRect()!
    const outerTop = f.outer().scrollTop
    f.input.wheel(f.renderer.flush(), {clientX: rect.left + 20, clientY: Math.max(5, rect.top + 40), deltaY: -40})
    await f.settle()
    expect(f.outer().scrollTop).toBe(outerTop)
    const reportCount = f.reports
    const row = inner.querySelector('[data-chat-history-id]')!
    row.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowUp", bubbles: true}))
    f.rerender()
    await f.settle()
    expect(f.outer().scrollTop).toBe(outerTop)
    // Ввод внутри вложенного viewport и обычный render не публикуют прежний
    // видимый диапазон outer заново; дальнейшая scroll chain всё ещё работает.
    expect(f.reports).toBe(reportCount)
    // Дойдём wheel до верхнего края inner; следующий wheel должен прокрутить outer.
    for (let i = 0; i < 24; i++) {
      f.input.wheel(f.renderer.flush(), {clientX: rect.left + 20, clientY: Math.max(5, rect.top + 40), deltaY: -80})
      await f.settle()
      if (f.outer().scrollTop < outerTop) break
    }
    expect(f.outer().scrollTop).toBeLessThan(outerTop)
  } finally {f.dispose()}
})
