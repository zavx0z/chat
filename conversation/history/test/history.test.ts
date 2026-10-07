import {expect, test} from "bun:test"
import {createHistoryWindow, type HistoryBody, type HistoryHeader, type HistorySelection} from "../index"

type HumanMessage = {id: string; conversationId: string; author: {id: string; name: string; kind: "human"}; text: string; display: "ordinary" | "details"}
type Header = HistoryHeader & {authorName: string; display: HumanMessage["display"]}
type Detail = {editorName: string; text: string}
const tick = () => Bun.sleep(0)

/** Личная беседа двух людей; transport и сохранение предоставляет fixture backend. */
function fixture(count = 192, textBytes = 32) {
  let snapshot: HistorySelection = {id: "conversation", history: {revision: 1, total: count}}
  const content = "a".repeat(textBytes)
  const items: HumanMessage[] = Array.from({length: count}, (_, index) => ({id: `m${index}`, conversationId: snapshot.id,
    author: {id: index % 2 ? "maria" : "vladimir", name: index % 2 ? "Мария" : "Владимир", kind: "human"}, text: content, display: "ordinary"}))
  const revisions = new Map<string, number>()
  const calls: {operation: string; conversationId: string; id?: string; query?: {before?: number; after?: number; around?: number; limit?: number; maxBytes?: number}; signal: AbortSignal}[] = []
  const gates = new Map<string, ReturnType<typeof Promise.withResolvers<unknown>>>()
  let hold = false
  const window = createHistoryWindow<Header, HumanMessage, Detail>({
    changed() {},
    isOrdinary: header => header.display === "ordinary",
    validateBody(body, header) {if (body.id !== header.id) throw new Error("Тело другой записи"); return body},
    source: {
      async readPage(conversationId, query, signal) {
        calls.push({operation: "page", conversationId, query, signal})
        if (conversationId !== snapshot.id) throw new Error("identity conflict")
        const limit = query.limit ?? 32
        const start = query.before !== undefined ? Math.max(0, query.before - limit) : query.after !== undefined ? query.after + 1 : query.around !== undefined ? Math.max(0, query.around - Math.floor(limit / 2)) : Math.max(0, count - limit)
        return {conversationId, revision: snapshot.history.revision, total: count, start,
          items: items.slice(start, start + limit).map((entry, offset) => ({id: entry.id, ordinal: start + offset, revision: revisions.get(entry.id) ?? 1,
            authorName: entry.author.name, display: entry.display, bodyBytes: new TextEncoder().encode(JSON.stringify(entry)).byteLength, evidenceCount: entry.display === "details" ? 1 : 0})),
          before: start > 0 ? start : null, after: start + limit < count ? start + limit - 1 : null}
      },
      async readBody(conversationId, id, signal) {
        calls.push({operation: "body", conversationId, id, signal})
        const entry = items.find(item => item.id === id)!
        const result = {conversationId, revision: revisions.get(id) ?? 1, id, bytes: new TextEncoder().encode(JSON.stringify(entry)).byteLength, entry, evidenceCount: 0}
        if (hold) {const gate = Promise.withResolvers<unknown>(); gates.set(id, gate); return gate.promise as Promise<HistoryBody<HumanMessage>>}
        return result
      },
      async readEvidence(conversationId, id, query, signal) {
        calls.push({operation: "evidence", conversationId, id, query, signal})
        return {conversationId, id, revision: revisions.get(id) ?? 1, total: 1, start: 0,
          items: [{editorName: "Мария", text: "Предыдущая редакция"}], before: null, after: null}
      },
    },
  })
  return {window, calls, items, gates, revisions, snapshot: () => snapshot, hold() {hold = true},
    accept(value: Partial<HistorySelection> = {}) {snapshot = {...snapshot, ...value}; window.accept(snapshot)},
    viewport(ids: string[], direction: "before" | "after" | "none" = "none", following = false) {window.viewport({ids, nearStart: direction === "before", nearEnd: direction === "after", following})}}
}

test("глубокая история держит не более трёх смежных страниц, сохраняет загруженные малые тела; eviction требует нового чтения", async () => {
  const f = fixture()
  f.accept()
  await tick()
  expect(f.window.getSnapshot().rows).toHaveLength(32)
  expect(f.calls.filter(call => call.operation === "body")).toHaveLength(0)
  f.viewport(["m160"])
  await tick()
  expect(f.window.getSnapshot().rows.find(row => row.header.id === "m160")!.body).toBeDefined()
  f.viewport(["m160"], "before")
  await tick()
  f.viewport(["m128"], "before")
  await tick()
  f.viewport(["m96"], "before")
  await tick()
  expect(f.window.getSnapshot().rows).toHaveLength(96)
  expect(f.window.getSnapshot().rows.at(-1)!.header.ordinal).toBe(159)
  expect(f.window.getSnapshot().rows.some(row => row.header.id === "m160")).toBe(false)
  f.viewport(["m128"], "after")
  await tick()
  f.viewport(["m160"])
  await tick()
  expect(f.calls.filter(call => call.operation === "body" && call.id === "m160")).toHaveLength(2)
  for (const call of f.calls.filter(call => call.operation === "page")) expect(call.query).toMatchObject({limit: 32, maxBytes: 65536})
  f.window.dispose()
})

test("чтение прошлых сообщений обновляет summary/unread; скрытие освобождает данные и возвращается к прежнему месту", async () => {
  const f = fixture()
  f.accept()
  await tick()
  f.viewport(["m160"], "before")
  await tick()
  const rows = f.window.getSnapshot().rows.map(row => row.header.id)
  const reads = f.calls.length
  f.accept({history: {revision: 2, total: 193}})
  expect(f.window.getSnapshot().rows.map(row => row.header.id)).toEqual(rows)
  expect(f.window.getSnapshot().unread).toBe(1)
  expect(f.calls).toHaveLength(reads)
  f.window.setActive(false)
  expect(f.window.getSnapshot().rows).toEqual([])
  expect(f.calls.some(call => call.operation === "cancel")).toBe(false)
  f.window.setActive(true)
  await tick()
  expect(f.window.getSnapshot().rows).toHaveLength(32)
  expect(f.calls.at(-1)!.query).toMatchObject({around: 160})
  expect(f.window.getSnapshot().following).toBe(false)
  f.window.dispose()
})

test("не более четырёх body requests, offscreen/dispose отменяют и поздний ответ не восстанавливает данные", async () => {
  const f = fixture(32)
  f.hold()
  f.accept()
  await tick()
  f.viewport(Array.from({length: 10}, (_, index) => `m${index}`))
  expect(f.calls.filter(call => call.operation === "body")).toHaveLength(4)
  f.viewport([])
  expect(f.calls.filter(call => call.operation === "body").every(call => call.signal.aborted)).toBe(true)
  for (const gate of f.gates.values()) gate.resolve({})
  await tick()
  expect(f.window.getSnapshot().rows.every(row => row.body === undefined)).toBe(true)
  f.window.dispose()
  expect(f.window.getSnapshot().rows).toEqual([])
})

test("смена беседы отзывает запросы и не принимает позднее содержимое прежней беседы", async () => {
  const f = fixture(32)
  f.hold()
  f.accept()
  await tick()
  f.viewport(["m0"])
  f.accept({id: "new-conversation"})
  const request = f.calls.find(call => call.operation === "body")!
  expect(request.signal.aborted).toBe(true)
  f.gates.get("m0")!.resolve({})
  await tick()
  expect(f.window.getSnapshot().conversationId).toBe("new-conversation")
  expect(f.window.getSnapshot().rows.every(row => row.body === undefined)).toBe(true)
  f.window.dispose()
})

test("byte cache ограничен4MiB; одновременно resident только одно oversize тело <=16MiB", async () => {
  const f = fixture(8, 2 * 1024 * 1024)
  f.accept()
  await tick()
  f.viewport(["m0", "m1", "m2", "m3"])
  await tick()
  const resident = f.window.getSnapshot().rows.filter(row => row.body !== undefined)
  expect(resident.reduce((sum, row) => sum + row.header.bodyBytes, 0)).toBeLessThanOrEqual(4 * 1024 * 1024)
  f.window.dispose()
  const large = fixture(4, 5 * 1024 * 1024)
  large.accept()
  await tick()
  large.viewport(["m0", "m1"])
  await tick()
  expect(large.window.getSnapshot().rows.filter(row => row.body !== undefined)).toHaveLength(1)
  const reads = large.calls.length
  await tick()
  expect(large.calls).toHaveLength(reads)
  large.window.dispose()
})

test("история правок читается по раскрытию; collapse освобождает данные, повторное раскрытие перечитывает", async () => {
  const f = fixture(1)
  f.items[0] = {...f.items[0]!, display: "details", text: "Предыдущая редакция сообщения"}
  f.accept()
  await tick()
  f.viewport(["m0"])
  expect(f.calls.filter(call => call.operation === "body")).toHaveLength(0)
  f.window.expand("m0", true)
  await tick()
  expect(f.window.getSnapshot().rows[0]!.body).toBeDefined()
  f.window.expand("m0", false)
  expect(f.window.getSnapshot().rows[0]!.body).toBeUndefined()
  f.window.expand("m0", true)
  await tick()
  expect(f.calls.filter(call => call.operation === "body")).toHaveLength(2)
  f.window.dispose()
})

test("обычная беседа двух людей работает с собственным backend и раскрывает редакции сообщения", async () => {
  const f = fixture(2)
  f.accept()
  await tick()
  f.viewport(["m0", "m1"])
  await tick()
  expect(f.window.getSnapshot().rows.map(row => row.body?.author)).toEqual([
    {id: "vladimir", name: "Владимир", kind: "human"},
    {id: "maria", name: "Мария", kind: "human"},
  ])
  await f.window.evidence("m1")
  expect(f.window.getSnapshot().rows[1]!.evidence?.items).toEqual([{editorName: "Мария", text: "Предыдущая редакция"}])
  expect(f.calls.every(call => call.conversationId === "conversation")).toBeTrue()
  expect(f.calls.find(call => call.operation === "evidence")?.query).toMatchObject({limit: 32, maxBytes: 131072})
  f.window.dispose()
})

test("редакция существующего сообщения меняет unread без новых messages; tail перечитывает новое body revision", async () => {
  const f = fixture(2)
  f.accept()
  await tick()
  f.viewport(["m0"])
  await tick()
  const reads = f.calls.length
  f.items[0] = {...f.items[0]!, text: "Исправленное сообщение"}
  f.revisions.set("m0", 2)
  f.accept({history: {revision: 2, total: 2}})
  expect(f.window.getSnapshot().unread).toBe(1)
  expect(f.calls).toHaveLength(reads)
  f.window.tail()
  await tick()
  expect(f.window.getSnapshot().rows[0]!.body?.text).toBe("Исправленное сообщение")
  expect(f.calls.filter(call => call.operation === "body" && call.id === "m0")).toHaveLength(2)
  expect(f.window.getSnapshot().unread).toBe(0)
  f.window.dispose()
})

test("page ожидает свободное место среди четырёх detail requests и затем исполняется", async () => {
  const f = fixture(32)
  f.hold()
  f.accept()
  await tick()
  f.viewport(["m0", "m1", "m2", "m3"])
  expect(f.calls.filter(call => call.operation === "body")).toHaveLength(4)
  const reads = f.calls.filter(call => call.operation === "page").length
  f.window.tail()
  expect(f.calls.filter(call => call.operation === "page")).toHaveLength(reads)
  const entry = f.items[0]!
  f.gates.get("m0")!.resolve({conversationId: "conversation", id: "m0", revision: 1,
    bytes: new TextEncoder().encode(JSON.stringify(entry)).byteLength, entry, evidenceCount: 0})
  await tick()
  expect(f.calls.filter(call => call.operation === "page")).toHaveLength(reads + 1)
  f.window.dispose()
  for (const gate of f.gates.values()) gate.resolve({})
  await tick()
})

test("одинаковый conversation id в другом source scope отзывает прежнее чтение", async () => {
  const f = fixture(2)
  f.hold()
  f.accept({scope: "first-source"})
  await tick()
  f.viewport(["m0"])
  const request = f.calls.find(call => call.operation === "body")!
  f.accept({scope: "second-source"})
  expect(request.signal.aborted).toBeTrue()
  f.gates.get("m0")!.resolve({})
  await tick()
  expect(f.window.getSnapshot().rows.every(row => row.body === undefined)).toBeTrue()
  f.window.dispose()
})

test("новая header revision отменяет прежнее body чтение; поздняя версия не заменяет новую", async () => {
  const f = fixture(2)
  f.hold()
  f.accept()
  await tick()
  f.viewport(["m0"])
  const oldGate = f.gates.get("m0")!
  const oldRequest = f.calls.find(call => call.operation === "body")!
  f.revisions.set("m0", 2)
  f.items[0] = {...f.items[0]!, text: "Новая версия"}
  f.accept({history: {revision: 2, total: 2}})
  f.window.tail()
  await tick()
  expect(oldRequest.signal.aborted).toBeTrue()
  const entry = f.items[0]!
  const body = {conversationId: "conversation", id: "m0", bytes: new TextEncoder().encode(JSON.stringify(entry)).byteLength, entry, evidenceCount: 0}
  oldGate.resolve({...body, revision: 1})
  await tick()
  expect(f.window.getSnapshot().rows[0]!.body).toBeUndefined()
  f.gates.get("m0")!.resolve({...body, revision: 2})
  await tick()
  expect(f.window.getSnapshot().rows[0]!.body?.text).toBe("Новая версия")
  f.window.dispose()
})

test("ошибка body старой revision не блокирует чтение исправленной записи", async () => {
  const f = fixture(2)
  f.hold()
  f.accept()
  await tick()
  f.viewport(["m0"], "none", true)
  f.gates.get("m0")!.resolve({})
  await tick()
  expect(f.window.getSnapshot().rows[0]!.error).toBeDefined()
  f.revisions.set("m0", 2)
  f.accept({history: {revision: 2, total: 2}})
  await tick()
  expect(f.calls.filter(call => call.operation === "body" && call.id === "m0")).toHaveLength(2)
  const entry = f.items[0]!
  f.gates.get("m0")!.resolve({conversationId: "conversation", id: "m0", revision: 2,
    bytes: new TextEncoder().encode(JSON.stringify(entry)).byteLength, entry, evidenceCount: 0})
  await tick()
  expect(f.window.getSnapshot().rows[0]!.error).toBeUndefined()
  expect(f.window.getSnapshot().rows[0]!.body).toBeDefined()
  f.window.dispose()
})

test("повтор чтения изменённой записи обновляет её страницу без перехода в хвост истории", async () => {
  const f = fixture()
  f.accept()
  await tick()
  f.viewport(["m160"], "before")
  await tick()
  f.viewport(["m128"])
  await tick()
  f.items[128] = {...f.items[128]!, text: "Исправленная запись прошлого"}
  f.revisions.set("m128", 2)
  f.accept({history: {revision: 2, total: 192}})
  f.window.retry("m128")
  await tick()
  expect(f.window.getSnapshot().following).toBeFalse()
  expect(f.window.getSnapshot().rows.find(row => row.header.id === "m128")!.body?.text).toBe("Исправленная запись прошлого")
  expect(f.calls.filter(call => call.operation === "page").at(-1)?.query).toMatchObject({after: 127})
  f.window.dispose()
})

test("неизменный snapshot стабилен; возврат к малому сообщению использует кеш, скрытие чата очищает его", async () => {
  const f = fixture()
  try {
    f.accept()
    await tick()
    f.viewport(["m160"])
    await tick()
    const first = f.window.getSnapshot()
    expect(f.window.getSnapshot()).toBe(first)
    for (let i = 0; i < 10; i++) {
      f.viewport([])
      expect(f.window.getSnapshot().rows.find(row => row.header.id === "m160")?.body).toBe(first.rows.find(row => row.header.id === "m160")?.body)
      f.viewport(["m160"])
      await tick()
      expect(f.window.getSnapshot().rows.find(row => row.header.id === "m160")?.body).toBeDefined()
    }
    expect(f.calls.filter(call => call.operation === "body" && call.id === "m160")).toHaveLength(1)
    f.window.setActive(false)
    f.window.setActive(true)
    await tick()
    f.viewport(["m160"])
    await tick()
    expect(f.calls.filter(call => call.operation === "body" && call.id === "m160")).toHaveLength(2)
  } finally {f.window.dispose()}
})

test("частые ревизии объединяются в одно чтение хвоста; закрытие отменяет отложенное чтение", async () => {
  let reads = 0
  let revision = 1
  const window = createHistoryWindow({refreshDelayMs: 30, changed() {}, isOrdinary: () => false,
    source: {
      async readPage(conversationId) {
        reads++
        return {conversationId, revision, total: 1, start: 0, items: [{id: "m", ordinal: 0, revision, bodyBytes: 1, evidenceCount: 0}], before: null, after: null}
      },
      async readBody() {throw new Error("unused")},
      async readEvidence() {throw new Error("unused")},
    },
  })
  try {
    window.accept({id: "s", history: {revision, total: 1}})
    await tick()
    expect(reads).toBe(1)
    for (revision = 2; revision <= 20; revision++) window.accept({id: "s", history: {revision, total: 1}})
    expect(reads).toBe(1)
    await Bun.sleep(45)
    expect(reads).toBe(2)
    window.accept({id: "s", history: {revision: 30, total: 1}})
    window.setActive(false)
    await Bun.sleep(45)
    expect(reads).toBe(2)
  } finally {window.dispose()}
})
