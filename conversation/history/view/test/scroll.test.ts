import {expect, test} from "bun:test"
import {createRoot} from "@zavx0z/immersive/XReact"
import {createDocument, type HTMLElement} from "@zavx0z/immersive"
import {flushDocumentLayoutObservers} from "@zavx0z/immersive"
import {createDocumentRenderer, createDocumentInteractionController} from "@zavx0z/immersive/renderer/html"
import type {CompiledTemplate} from "@zavx0z/immersive/XReact/compiled"
import {createHistoryWindow, type HistoryHeader} from "../../index"
import Fixture, {type Props, type Body} from "./fixture"
import {captureHistoryAnchor} from "../src/history-anchor"

function fixture() {
  const document = createDocument()
  const host = document.createElement("div")
  document.append(host)
  const root = createRoot(host)
  const renderer = createDocumentRenderer({document, root: host, viewport: {width: 360, height: 320}})
  const input = createDocumentInteractionController({document})
  let dirty = true
  let hidden = false
  let overlay = false
  let heights: ReadonlyMap<string, number> = new Map()
  let held: ReturnType<typeof Promise.withResolvers<void>> | null = null
  const pages: {before?: number, after?: number}[] = []
  const count = 256
  const history = createHistoryWindow<HistoryHeader, Body, unknown>({changed() {dirty = true}, isOrdinary: () => true,
    source: {
      async readPage(conversationId, query) {
        pages.push(query)
        if (held) await held.promise
        const start = query.before !== undefined ? Math.max(0, query.before - 32) : query.after !== undefined ? query.after + 1 : query.around !== undefined ? Math.max(0, query.around - 16) : count - 32
        return {conversationId, revision: 1, total: count, start,
          items: Array.from({length: Math.min(32, count - start)}, (_, offset) => ({id: `m${start + offset}`, ordinal: start + offset, revision: 1, bodyBytes: 16, evidenceCount: 0})),
          before: start === 0 ? null : start, after: start + 32 < count ? start + 31 : null}
      },
      async readBody(conversationId, id) {return {conversationId, id, revision: 1, bytes: 16, evidenceCount: 0, entry: {height: [80, 140, 100, 180][Number(id.slice(1)) % 4]!}}},
      async readEvidence() {throw new Error("Unused")},
    },
  })
  const settle = async () => {
    for (let round = 0; round < 18; round++) {
      if (dirty) {
        dirty = false
        const props: Props = {hidden, onVisible(value) {history.setActive(value && !overlay)}, history: history.getSnapshot(), heights, onViewport: history.viewport, onHeights(value) {heights = value}, onTail: history.tail}
        root.render(Fixture as unknown as CompiledTemplate<Props>, props)
      }
      root.flush()
      renderer.flush()
      flushDocumentLayoutObservers(document)
      await Bun.sleep(0)
    }
  }
  const log = () => host.querySelector('[role="log"]') as HTMLElement
  const nodes = () => [...host.querySelectorAll("[data-chat-history-id]")] as HTMLElement[]
  const wheel = (deltaY: number) => {
    const frame = renderer.flush()
    const rect = log().getLayoutRect()!
    return input.wheel(frame, {clientX: rect.left + 20, clientY: rect.top + 100, deltaX: 0, deltaY})
  }
  history.accept({id: "conversation", history: {revision: 1, total: count}})
  return {document, host, root, renderer, history, pages, settle, log, nodes, wheel,
    hide() {hidden = true; dirty = true}, show() {hidden = false; dirty = true},
    overlay(value: boolean) {overlay = value; history.setActive(!hidden && !overlay); dirty = true},
    holdPage() {held = Promise.withResolvers<void>()}, releasePage() {const gate = held; held = null; gate?.resolve()},
    dispose() {input.dispose(); history.dispose(); root.unmount(); renderer.dispose()},
  }
}

test("wheel оставляет tail, последующий render не откатывает scroll; prepend+eviction сохраняют variable-height anchor<=1px", async () => {
  const f = fixture()
  try {
    await f.settle()
    expect(f.history.getSnapshot().following).toBe(true)
    const tail = f.log().scrollTop
    expect(tail).toBeGreaterThan(1000)
    expect(f.wheel(-300)).not.toBeNull()
    const changed = f.log().scrollTop
    expect(changed).toBeLessThan(tail)
    await f.settle()
    expect(f.history.getSnapshot().following).toBe(false)
    expect(f.log().scrollTop).toBeLessThan(tail - 100)
    const stable = f.log().scrollTop
    await f.settle()
    expect(Math.abs(f.log().scrollTop - stable)).toBeLessThanOrEqual(1)
    // Чтение ещё трёх старых страниц приводит к удалению дальнего хвоста.
    for (let page = 0; page < 3; page++) {
      f.holdPage()
      f.wheel(-10000)
      await f.settle()
      const anchor = captureHistoryAnchor(f.log() as unknown as globalThis.HTMLElement, f.nodes() as unknown as globalThis.HTMLElement[])!
      expect(anchor).not.toBeNull()
      const before = f.history.getSnapshot().rows[0]!.header.ordinal
      f.releasePage()
      await f.settle()
      expect(f.history.getSnapshot().rows[0]!.header.ordinal).toBeLessThan(before)
      const row = f.nodes().find(node => node.getAttribute("data-chat-history-id") === anchor.id)!
      expect(row).toBeDefined()
      expect(Math.abs(row.getLayoutRect(f.log())!.top - anchor.top)).toBeLessThanOrEqual(1)
      expect(f.history.getSnapshot().rows.length).toBeLessThanOrEqual(96)
      expect(f.nodes().length).toBeLessThanOrEqual(96)
    }
    expect(f.history.getSnapshot().rows.at(-1)!.header.ordinal).toBeLessThan(255)
    expect(f.pages.filter(page => page.before !== undefined).length).toBeGreaterThanOrEqual(3)
    const oldest = f.history.getSnapshot().rows[0]!.header.ordinal
    f.holdPage()
    f.wheel(10000)
    await f.settle()
    const forwardAnchor = captureHistoryAnchor(f.log() as unknown as globalThis.HTMLElement, f.nodes() as unknown as globalThis.HTMLElement[])!
    expect(forwardAnchor).not.toBeNull()
    f.releasePage()
    await f.settle()
    expect(f.history.getSnapshot().rows[0]!.header.ordinal).toBeGreaterThan(oldest)
    const forwardRow = f.nodes().find(node => node.getAttribute("data-chat-history-id") === forwardAnchor.id)!
    expect(forwardRow).toBeDefined()
    expect(Math.abs(forwardRow.getLayoutRect(f.log())!.top - forwardAnchor.top)).toBeLessThanOrEqual(1)
    expect(f.pages.some(page => page.after !== undefined)).toBe(true)
    expect(f.nodes().length).toBeLessThanOrEqual(96)
  } finally {f.dispose()}
})


test("hide/show и overlay close после большого окна снова читают видимые bodies без wheel", async () => {
  const f = fixture()
  try {
    await f.settle()
    for (let page = 0; page < 3; page++) {f.wheel(-10000); await f.settle()}
    expect(f.nodes()).toHaveLength(96)
    for (let page = 0; page < 3; page++) {f.wheel(10000); await f.settle()}
    const before = f.log().scrollTop
    expect(before).toBeGreaterThan(3000)
    f.overlay(true)
    await f.settle()
    expect(f.history.getSnapshot().rows).toHaveLength(0)
    f.overlay(false)
    await f.settle()
    expect(f.history.getSnapshot().rows.some(row => row.body !== undefined)).toBe(true)
    f.hide()
    await f.settle()
    expect(f.history.getSnapshot().rows).toHaveLength(0)
    f.show()
    await f.settle()
    expect(f.history.getSnapshot().rows.some(row => row.body !== undefined)).toBe(true)
    expect(f.nodes().length).toBeLessThanOrEqual(96)
    const top = f.log().scrollTop
    await f.settle()
    expect(f.history.getSnapshot().rows.some(row => row.body !== undefined)).toBe(true)
    expect(Math.abs(f.log().scrollTop - top)).toBeLessThanOrEqual(1)
    f.holdPage()
    f.wheel(-10000)
    await f.settle()
    f.releasePage()
    await f.settle()
    f.wheel(-300)
    await f.settle()
    expect(f.history.getSnapshot().following).toBe(false)
    const past = captureHistoryAnchor(f.log() as unknown as globalThis.HTMLElement, f.nodes() as unknown as globalThis.HTMLElement[])!
    f.hide()
    await f.settle()
    expect(f.history.getSnapshot().rows).toHaveLength(0)
    expect(f.log().scrollTop).toBe(0)
    f.show()
    await f.settle()
    const pastRow = f.nodes().find(row => row.getAttribute("data-chat-history-id") === past.id)!
    expect(pastRow).toBeDefined()
    expect(Math.abs(pastRow.getLayoutRect(f.log())!.top - past.top)).toBeLessThanOrEqual(1)
    expect(f.history.getSnapshot().following).toBe(false)
    expect(f.history.getSnapshot().rows.some(row => row.body !== undefined)).toBe(true)
  } finally {f.dispose()}
})
