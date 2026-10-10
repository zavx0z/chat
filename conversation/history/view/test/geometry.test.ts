import {expect, test} from "bun:test"
import {createRoot} from "@zavx0z/immersive/XReact"
import {createDocument, HTMLElement} from "@zavx0z/immersive"
import {flushDocumentLayoutObservers} from "@zavx0z/immersive"
import {createDocumentRenderer, createDocumentInteractionController} from "@zavx0z/immersive/renderer/html"
import type {CompiledTemplate} from "@zavx0z/immersive/XReact/compiled"
import Fixture, {type Props} from "./fixture"

/** Считаем только чтения production viewport; observer читает рамки через свой public owner. */
async function fixture(count: number) {
  const document = createDocument()
  const host = document.createElement("div")
  document.append(host)
  const root = createRoot(host)
  let following = true
  let dirty = true
  let heights: ReadonlyMap<string, number> = new Map()
  let heightReports = 0
  let viewportReports = 0
  let rowReads = 0
  const original = HTMLElement.prototype.getLayoutRect
  HTMLElement.prototype.getLayoutRect = function(...arguments_) {
    if (this.hasAttribute("data-chat-history-id")) rowReads++
    return original.apply(this, arguments_)
  }
  const rows = Array.from({length: count}, (_, ordinal) => ({
    header: {id: `m${ordinal}`, ordinal, revision: 1, bodyBytes: 16, evidenceCount: 0},
    body: {height: 80}, visible: true, expanded: false, loading: false,
  }))
  const render = () => root.render(Fixture as unknown as CompiledTemplate<Props>, {
    hidden: false,
    onVisible() {},
    history: {conversationId: "conversation", revision: 1, total: count, rows, before: null, after: null, unread: 0, following, loading: false},
    heights,
    onViewport(value) {
      viewportReports++
      if (following !== value.following) {following = value.following; dirty = true}
    },
    onHeights(value) {heights = value; heightReports++},
    onTail() {},
  })
  // Первый effect действительно выполняется без geometry provider. Подписка
  // должна пережить это состояние и получить геометрию после подключения.
  render()
  dirty = false
  root.flush()
  await Bun.sleep(0)
  const renderer = createDocumentRenderer({document, root: host, viewport: {width: 360, height: 320}})
  const input = createDocumentInteractionController({document})
  const settle = async () => {
    for (let round = 0; round < 8; round++) {
      if (dirty) {dirty = false; render()}
      root.flush()
      renderer.flush()
      flushDocumentLayoutObservers(document)
      await Bun.sleep(0)
    }
  }
  const log = () => host.querySelector('[role="log"]') as HTMLElement
  return {
    host, log, settle,
    get reads() {return rowReads},
    get heightReports() {return heightReports},
    get viewportReports() {return viewportReports},
    get heights() {return heights},
    get following() {return following},
    rerender() {dirty = true},
    wheel(deltaY: number) {
      const rect = log().getLayoutRect()!
      return input.wheel(renderer.flush(), {clientX: rect.left + 20, clientY: rect.top + 100, deltaX: 0, deltaY})
    },
    resizeFirst(height: number) {
      rows[0]!.body = {height}
      dirty = true
    },
    dispose() {
      input.dispose()
      root.unmount()
      renderer.dispose()
      HTMLElement.prototype.getLayoutRect = original
    },
  }
}

test.each([12, 48])("%i строк: первый mount измерен, callbacks scroll имеют линейный предел чтений и не публикуют размеры повторно", async count => {
  const f = await fixture(count)
  try {
    await f.settle()
    expect(f.heights.size).toBe(count)
    expect(f.log().scrollTop).toBeGreaterThan(500)
    expect(f.reads).toBeLessThanOrEqual(count * 4)
    const heightReports = f.heightReports
    const before = f.reads
    const reports = f.viewportReports
    expect(f.wheel(-80)).not.toBeNull()
    await f.settle()
    expect(f.following).toBeFalse()
    // N row callbacks одного scroll не запускают N полных проходов.
    expect(f.reads - before).toBeLessThanOrEqual(count * 3)
    expect(f.viewportReports - reports).toBeLessThanOrEqual(2)
    expect(f.heightReports).toBe(heightReports)
    const stableReads = f.reads
    const stableReports = f.viewportReports
    f.rerender()
    await f.settle()
    expect(f.reads).toBe(stableReads)
    expect(f.viewportReports).toBe(stableReports)
    const anchor = f.host.querySelector('[data-chat-history-id="m9"]') as HTMLElement
    const top = anchor.getLayoutRect(f.log())!.top
    const acceptedHeights = f.heights
    f.resizeFirst(110)
    await f.settle()
    expect(Math.abs(anchor.getLayoutRect(f.log())!.top - top)).toBeLessThanOrEqual(1)
    expect(f.heights.get("m0")).toBe(110)
    expect(acceptedHeights.get("m0")).toBe(80)
  } finally {f.dispose()}
})

test("рост содержимого при follow-tail сохраняет конец окна, поздний geometry callback не теряет первую публикацию", async () => {
  const f = await fixture(12)
  try {
    await f.settle()
    const before = f.log().scrollTop
    f.resizeFirst(180)
    await f.settle()
    expect(f.following).toBeTrue()
    expect(Math.abs(f.log().scrollTop - before - 100)).toBeLessThanOrEqual(1)
    const last = f.host.querySelector('[data-chat-history-id="m11"]') as HTMLElement
    expect(last.getLayoutRect(f.log())!.bottom).toBeLessThanOrEqual(f.log().getLayoutRect()!.height)
    expect(f.heights.get("m0")).toBe(180)
  } finally {f.dispose()}
})

test("короткая первая страница публикует ids и размеры, хотя follow-tail не меняет scrollTop", async () => {
  const f = await fixture(3)
  try {
    await f.settle()
    expect(f.log().scrollTop).toBe(0)
    expect(f.viewportReports).toBe(1)
    expect(f.heights.size).toBe(3)
    expect(f.following).toBeTrue()
  } finally {f.dispose()}
})
