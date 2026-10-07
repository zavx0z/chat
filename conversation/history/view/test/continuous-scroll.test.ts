import {expect, test} from "bun:test"
import {createRoot} from "@zavx0z/immersive-component"
import {createDocument, Event, type HTMLElement} from "@zavx0z/immersive-dom"
import {flushDocumentLayoutObservers} from "@zavx0z/immersive-dom/geometry"
import {createDocumentRenderer, createDocumentInteractionController} from "@zavx0z/immersive-renderer-html"
import type {CompiledTemplate} from "@zavx0z/immersive-template/compiled"
import Fixture, {type Props, type Row} from "./continuous-scroll-fixture"

function fixture(initial?: readonly Row[]) {
  const document = createDocument()
  const host = document.createElement("div")
  document.append(host)
  const root = createRoot(host)
  const renderer = createDocumentRenderer({document, root: host, viewport: {width: 360, height: 320}})
  const input = createDocumentInteractionController({document})
  let rows: readonly Row[] = initial ?? Array.from({length: 18}, (_, index) => ({id: `m${index}`, height: [72, 96, 84][index % 3]!}))
  let headers = rows.map(row => ({header: {id: row.id}}))
  let following = true
  let expanded = false
  let dirty = true
  let geometryBatches = 0
  let viewport: Parameters<Props["onViewport"]>[0] | undefined
  const writes: {from: number, to: number}[] = []
  const counters = {checkedBatches: 0, checkedWheelEvents: 0, postInputScrollWrites: 0, documentMutations: 0}
  const mutations: {type: string, node: string, attribute?: string, oldValue?: string | null, newValue?: string | null}[] = []
  const log = () => host.querySelector("[data-chat-messages]") as HTMLElement
  const release = document.subscribeStateChanges(batch => {
    for (const record of batch.records) if (record.type === "scroll" && record.target === log()) {
      writes.push({from: record.oldScrollTop, to: record.scrollTop})
    }
  })
  const releaseMutations = document.subscribeMutations(batch => {
    for (const record of batch.records) mutations.push({type: record.type, node: record.target.nodeName,
      ...(record.type === "attributes" ? {attribute: record.attributeName, oldValue: record.oldValue, newValue: record.newValue} : {})})
  })
  const render = () => {
    const props: Props = {rows, expanded,
      history: {rows: headers, total: rows.length, following, after: null, unread: 0, loading: false},
      onViewport(value) {viewport = value; if (following !== value.following) {following = value.following; dirty = true}},
      onToggle(value) {expanded = value; dirty = true},
    }
    root.render(Fixture as unknown as CompiledTemplate<Props>, props)
  }
  const settle = async (rounds = 8) => {
    for (let round = 0; round < rounds; round++) {
      if (dirty) {dirty = false; render()}
      root.flush()
      renderer.flush()
      if (flushDocumentLayoutObservers(document)) geometryBatches++
      await Bun.sleep(0)
    }
  }
  return {host, log, settle, writes, mutations, counters,
    get viewport() {return viewport}, get following() {return following}, get expanded() {return expanded}, get geometryBatches() {return geometryBatches},
    maximum() {return renderer.flush().scrolls.get(log())!.maxScrollTop},
    clearWrites() {writes.length = 0},
    clearMutations() {mutations.length = 0},
    wheel(deltaY: number) {
      const frame = renderer.flush()
      const box = log().getLayoutRect()!
      expect(input.wheel(frame, {clientX: box.left + 20, clientY: box.top + 100, deltaX: 0, deltaY})).not.toBeNull()
    },
    append() {rows = [...rows, {id: `m${rows.length}`, height: 96}]; headers = rows.map(row => ({header: {id: row.id}})); dirty = true},
    prepend() {rows = [{id: "older", height: 113}, ...rows]; headers = rows.map(row => ({header: {id: row.id}})); dirty = true},
    growLast(delta: number) {rows = rows.map((row, index) => index === rows.length - 1 ? {...row, height: row.height + delta} : row); dirty = true},
    rerender() {dirty = true},
    dispose() {release(); releaseMutations(); input.dispose(); root.unmount(); renderer.dispose()},
  }
}

async function assertNativeBatch(f: ReturnType<typeof fixture>, deltas: readonly number[]) {
  f.clearMutations()
  const before = f.log().scrollTop
  const maximum = f.maximum()
  let expected = before
  for (const delta of deltas) {
    f.wheel(delta)
    expected = Math.max(0, Math.min(maximum, expected + delta))
    expect(Math.abs(f.log().scrollTop - expected)).toBeLessThanOrEqual(0.5)
  }
  const afterNative = f.log().scrollTop
  // С этого момента input завершён. Следующие records принадлежат geometry/
  // component lifecycle; неизменное содержимое не разрешает им исправлять scroll.
  f.clearWrites()
  await f.settle()
  f.counters.checkedBatches++
  f.counters.checkedWheelEvents += deltas.length
  f.counters.postInputScrollWrites += f.writes.length
  f.counters.documentMutations += f.mutations.length
  if (f.writes.length || Math.abs(f.log().scrollTop - afterNative) > 0.5) {
    console.log(JSON.stringify({deltas, before, afterNative, afterGeometry: f.log().scrollTop, maximum, corrections: f.writes, mutations: f.mutations}))
  }
  expect(f.writes, "Нет size/topology изменения: после native wheel не должно быть owned scroll writes").toEqual([])
  expect(f.mutations, "Обычный wheel сохраняет scroll fast path: без children/attribute/text изменений Document").toEqual([])
  expect(Math.abs(f.log().scrollTop - afterNative), "История не разворачивает и не ускоряет пользовательскую инерцию").toBeLessThanOrEqual(0.5)
}

test("обычные 20px wheel и плотные inertial batches у нижнего края не создают программный jump/reversal", async () => {
  const f = fixture()
  try {
    await f.settle()
    f.wheel(-160)
    await f.settle()
    expect(f.following).toBeFalse()
    const articles = [...f.host.querySelectorAll("article")]
    // По одному delivery, затем несколько wheel до следующей доставки geometry.
    for (let step = 0; step < 10; step++) await assertNativeBatch(f, [20])
    for (const batch of [[-20, -20, -20], [20, 20], [-16, -12, -8, -4], [16, 12, 8, 4], [-20], [20]]) {
      await assertNativeBatch(f, batch)
    }
    expect(f.geometryBatches).toBeGreaterThan(0)
    expect([...f.host.querySelectorAll("article")]).toEqual(articles)
    const stable = f.log().scrollTop
    f.clearWrites()
    f.rerender()
    await f.settle()
    expect(f.writes).toEqual([])
    expect(f.log().scrollTop).toBe(stable)
    console.log(JSON.stringify({case: "ordinary-scroll", ...f.counters, geometryDeliveryBatches: f.geometryBatches,
      maximum: f.maximum(), finalScrollTop: f.log().scrollTop, stableArticles: articles.length}))
  } finally {f.dispose()}
})

test("follow-tail достигает реального конца с 12px padding и append следует новому максимуму; prepend сохраняет anchor", async () => {
  const f = fixture()
  try {
    await f.settle()
    const drift = f.maximum() - f.log().scrollTop
    console.log(JSON.stringify({case: "bottom-padding", padding: 12, maximum: f.maximum(), actual: f.log().scrollTop, drift}))
    expect(Math.abs(drift), "End sentinel лежит перед bottom padding; follow должен учитывать весь scroll range").toBeLessThanOrEqual(0.5)
    expect(f.following).toBeTrue()
    // Инерция присылает ещё несколько положительных wheel уже после clamp.
    // Нулевая фактическая прокрутка не должна отключить будущий follow-tail.
    await assertNativeBatch(f, [20, 20])
    const previous = f.maximum()
    f.append()
    await f.settle()
    expect(f.maximum()).toBeGreaterThan(previous)
    expect(Math.abs(f.maximum() - f.log().scrollTop)).toBeLessThanOrEqual(0.5)
    expect(f.following).toBeTrue()
    f.wheel(-240)
    await f.settle()
    expect(f.following).toBeFalse()
    const box = f.log().getLayoutRect()!
    const visible = [...f.host.querySelectorAll("[data-chat-history-id]")].map(row => ({row, rect: row.getLayoutRect(f.log())!}))
      .filter(item => item.rect.bottom > 0 && item.rect.top < box.height)
    const anchor = visible.find(item => item.rect.top >= 0) ?? visible[0]!
    f.prepend()
    await f.settle()
    expect(Math.abs(anchor.row.getLayoutRect(f.log())!.top - anchor.rect.top)).toBeLessThanOrEqual(1)
    expect(f.following).toBeFalse()
  } finally {f.dispose()}
})

test("маленькая страница публикуется при scrollTop0; clicked group pin переживает рост контента", async () => {
  const small = fixture([{id: "small", height: 60}])
  try {await small.settle(); expect(small.log().scrollTop).toBe(0); expect(small.following).toBeTrue(); expect(small.viewport?.ids).toEqual(["small"])}
  finally {small.dispose()}
  const f = fixture([{id: "past", height: 1400}, {id: "group", height: 26, group: true}, {id: "assistant", height: 240}])
  try {
    await f.settle()
    const group = f.host.querySelector('[data-chat-history-id="group"]')!
    f.growLast(group.getLayoutRect(f.log())!.top + 8)
    await f.settle()
    const before = group.getLayoutRect(f.log())!.top
    expect(before).toBeLessThan(0)
    expect(before).toBeGreaterThan(-26)
    const button = group.querySelector("button")!
    button.dispatchEvent(new Event("pointerdown", {bubbles: true}))
    button.dispatchEvent(new Event("click", {bubbles: true}))
    await f.settle()
    expect(f.expanded).toBeTrue()
    expect(f.following).toBeFalse()
    expect(Math.abs(group.getLayoutRect(f.log())!.top - before)).toBeLessThanOrEqual(1)
  } finally {f.dispose()}
})

test("последовательные fractional size изменения не теряют follow-tail при неизменном пользовательском scroll", async () => {
  const f = fixture()
  try {
    await f.settle()
    for (let step = 0; step < 8; step++) {
      const before = f.maximum()
      f.growLast(0.25)
      await f.settle()
      expect(f.maximum()).toBeGreaterThan(before)
      if (!f.following) console.log(JSON.stringify({case: "fractional-growth", step, maximum: f.maximum(), actual: f.log().scrollTop, drift: f.maximum() - f.log().scrollTop}))
      expect(f.following, "Накопленные subpixel layout изменения не являются намерением уйти от tail").toBeTrue()
      expect(Math.abs(f.maximum() - f.log().scrollTop)).toBeLessThanOrEqual(0.5)
    }
  } finally {f.dispose()}
})
