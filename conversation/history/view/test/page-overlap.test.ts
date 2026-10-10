import {expect, test} from "bun:test"
import {createRoot} from "@zavx0z/immersive/XReact"
import {createDocument, type HTMLElement} from "@zavx0z/immersive"
import {flushDocumentLayoutObservers} from "@zavx0z/immersive"
import {createDocumentRenderer, createDocumentInteractionController} from "@zavx0z/immersive/renderer/html"
import type {CompiledTemplate} from "@zavx0z/immersive/XReact/compiled"
import {createHistoryWindow, type HistoryHeader} from "../../index"
import Fixture, {type Props, type Body} from "./fixture"
import {captureHistoryAnchor} from "../src/history-anchor"

async function probe() {
  const document = createDocument()
  const host = document.createElement("div")
  document.append(host)
  const root = createRoot(host)
  const renderer = createDocumentRenderer({document, root: host, viewport: {width: 360, height: 320}})
  const input = createDocumentInteractionController({document})
  let dirty = true
  let heights: ReadonlyMap<string, number> = new Map()
  let held: ReturnType<typeof Promise.withResolvers<void>> | null = null
  const releaseHeld = () => held?.resolve()
  const pageCalls: {before?: number; after?: number}[] = []
  const count = 108
  const controller = createHistoryWindow<HistoryHeader, Body, unknown>({pageSize: 16, maxPages: 2,
    changed() {dirty = true}, isOrdinary: () => true,
    source: {
      async readPage(conversationId, query) {
        pageCalls.push(query)
        if (held) await held.promise
        const limit = query.limit!
        const start = query.before !== undefined ? Math.max(0, query.before - limit) : query.after !== undefined ? query.after + 1 : query.around !== undefined ? Math.max(0, query.around - Math.floor(limit / 2)) : count - limit
        return {conversationId, revision: 1, total: count, start,
          items: Array.from({length: Math.min(limit, count - start)}, (_, offset) => ({id: `m${start + offset}`, ordinal: start + offset, revision: 1, bodyBytes: 16, evidenceCount: 0})),
          before: start > 0 ? start : null, after: start + limit < count ? start + limit - 1 : null}
      },
      async readBody(conversationId, id) {return {conversationId, id, revision: 1, bytes: 16, entry: {height: [80, 140, 100, 180][Number(id.slice(1)) % 4]!}, evidenceCount: 0}},
      async readEvidence() {throw new Error("unused")},
    },
  })
  const log = () => host.querySelector('[role="log"]') as HTMLElement
  const nodes = () => [...host.querySelectorAll("[data-chat-history-id]")] as HTMLElement[]
  let peakRows = 0
  const settle = async () => {
    for (let round = 0; round < 18; round++) {
      if (dirty) {
        dirty = false
        root.render(Fixture as unknown as CompiledTemplate<Props>, {hidden: false, onVisible: controller.setActive, history: controller.getSnapshot(), heights,
          onViewport: controller.viewport, onHeights(value) {heights = value}, onTail: controller.tail})
      }
      root.flush(); renderer.flush(); flushDocumentLayoutObservers(document)
      peakRows = Math.max(peakRows, nodes().length)
      await Bun.sleep(0)
    }
  }
  const wheel = (deltaY: number) => {
    const frame = renderer.flush()
    const rect = log().getLayoutRect()!
    input.wheel(frame, {clientX: rect.left + 20, clientY: rect.top + 100, deltaY})
  }
  const anchor = () => captureHistoryAnchor(log() as unknown as globalThis.HTMLElement, nodes() as unknown as globalThis.HTMLElement[])!
  const transition = async (direction: number) => {
    held = Promise.withResolvers<void>()
    wheel(direction)
    await settle()
    const previous = anchor()
    const callsBeforeRelease = pageCalls.length
    const gate = held
    held = null
    gate.resolve()
    await settle()
    const retained = nodes().find(node => node.getAttribute("data-chat-history-id") === previous.id)
    const after = anchor()
    return {previous, after, retained: !!retained, drift: retained ? retained.getLayoutRect(log())!.top - previous.top : null,
      resident: controller.getSnapshot().rows.map(row => row.header.ordinal), callsBeforeRelease, callsAfterRelease: pageCalls.length, scrollTop: log().scrollTop}
  }
  try {
    controller.accept({id: "group", history: {revision: 1, total: count}})
    await settle()
    const backwards = await transition(-10000)
    const evictingBackwards = await transition(-10000)
    const forwards = await transition(10000)
    return {backwards, evictingBackwards, forwards, peakRows, totalPageReads: pageCalls.length}
  } finally {releaseHeld(); input.dispose(); controller.dispose(); root.unmount(); renderer.dispose()}
}

test("две страницы по16 сохраняют видимую строку при prepend, eviction и обратной прокрутке без автопропусков", async () => {
  const result = await probe()
  for (const transition of [result.backwards, result.evictingBackwards, result.forwards]) {
    expect(transition.retained).toBeTrue()
    expect(Math.abs(transition.drift!)).toBeLessThanOrEqual(1)
    expect(transition.callsAfterRelease).toBe(transition.callsBeforeRelease)
    expect(transition.resident).toHaveLength(32)
  }
  expect(result.backwards.resident[0]).toBe(76)
  expect(result.evictingBackwards.resident[0]).toBe(60)
  expect(result.forwards.resident[0]).toBe(76)
  expect(result.peakRows).toBe(32)
  expect(result.totalPageReads).toBe(4)
}, 20000)
