import {expect, test} from "bun:test"
import {createHistoryWindow, type HistoryHeader, type HistoryPage} from "../index"

const tick = () => Bun.sleep(0)
type Body = {text: string}

function fixture(count = 12) {
  let revision = 1
  let notifications = 0
  let reads = 0
  const bodies = new Map<string, {text: string}>()
  const revisions = new Map<string, number>()
  for (let i = 0; i < count; i++) bodies.set(`m${i}`, {text: `Сообщение ${i}`})
  const window = createHistoryWindow<HistoryHeader, Body, never>({
    changed() {notifications++},
    isOrdinary: () => true,
    source: {
      async readPage(conversationId, query) {
        reads++
        const all = [...bodies.keys()]
        const start = query.before !== undefined ? Math.max(0, query.before - 32)
          : query.after !== undefined ? query.after + 1
            : query.around !== undefined ? Math.max(0, query.around - 16) : Math.max(0, all.length - 32)
        const items = all.slice(start, start + 32).map((id, i) => ({id, ordinal: start + i,
          revision: revisions.get(id) ?? 1, bodyBytes: 100, evidenceCount: 0}))
        return {conversationId, revision, total: all.length, start, items,
          before: start > 0 ? start : null, after: start + items.length < all.length ? start + items.length - 1 : null,
          bodies: items.map(header => ({conversationId, id: header.id, revision: header.revision,
            bytes: 100, entry: bodies.get(header.id)!, evidenceCount: 0}))}
      },
      async readBody() {throw new Error("Малая страница уже содержит сообщения")},
      async readEvidence() {throw new Error("Не запрошено")},
    },
  })
  return {window, bodies, reads: () => reads, notifications: () => notifications,
    accept() {window.accept({id: "c", history: {revision, total: bodies.size}})},
    update(id: string, text: string) {revision++; revisions.set(id, revision); bodies.set(id, {text})},
  }
}

test("готовая малая страница сохраняет тела и snapshot при двадцати возвратах без IO/notify", async () => {
  const f = fixture()
  try {
    f.accept()
    await tick()
    f.window.viewport({ids: ["m0"], nearStart: false, nearEnd: false, following: false})
    const initial = f.window.getSnapshot()
    expect(initial.rows.every(row => row.body !== undefined)).toBeTrue()
    const notifications = f.notifications()
    for (let cycle = 0; cycle < 20; cycle++) {
      for (const ids of [["m11"], [], ["m0"]]) {
        f.window.viewport({ids, nearStart: false, nearEnd: false, following: false})
        expect(f.window.getSnapshot()).toBe(initial)
      }
    }
    expect(f.reads()).toBe(1)
    expect(f.notifications()).toBe(notifications)
    f.window.setActive(false)
    expect(f.window.getSnapshot().rows).toEqual([])
  } finally {f.window.dispose()}
})

test("обновление сообщения атомарно заменяет версию без промежуточного удаления тела", async () => {
  const f = fixture()
  try {
    f.accept()
    await tick()
    const previous = f.window.getSnapshot().rows[0]!.body
    f.update("m0", "Потоковый ответ")
    f.accept()
    expect(f.window.getSnapshot().rows[0]!.body).toBe(previous)
    await tick()
    expect(f.window.getSnapshot().rows[0]!.body?.text).toBe("Потоковый ответ")
    expect(f.window.getSnapshot().rows.every(row => row.body !== undefined)).toBeTrue()
  } finally {f.window.dispose()}
})

test("сдвигающийся хвост сохраняет соседние страницы и предел 96 заголовков", async () => {
  const f = fixture(128)
  try {
    f.accept()
    await tick()
    for (const id of ["m96", "m64"]) {
      f.window.viewport({ids: [id], nearStart: true, nearEnd: false, following: false})
      await tick()
    }
    expect(f.window.getSnapshot().rows).toHaveLength(96)
    f.window.viewport({ids: ["m127"], nearStart: false, nearEnd: false, following: true})
    for (let i = 128; i < 138; i++) {
      f.update(`m${i}`, `Новый ответ ${i}`)
      f.accept()
      await tick()
      const rows = f.window.getSnapshot().rows
      expect(rows).toHaveLength(96)
      expect(rows[0]?.header.id).toBe(`m${i - 95}`)
      expect(rows.at(-1)?.header.id).toBe(`m${i}`)
      expect(rows.every(row => row.body !== undefined)).toBeTrue()
    }
  } finally {f.window.dispose()}
})

test("тело новее заголовка принимается без ошибки и повторного пустого сообщения", async () => {
  let reads = 0
  const window = createHistoryWindow({changed() {}, isOrdinary: () => true,
    source: {
      async readPage(conversationId) {return {conversationId, revision: 1, total: 1, start: 0,
        items: [{id: "m", ordinal: 0, revision: 1, bodyBytes: 5, evidenceCount: 0}], before: null, after: null}},
      async readBody(conversationId, id) {reads++; return {conversationId, id, revision: 2, bytes: 5, entry: "newer", evidenceCount: 0}},
      async readEvidence() {throw new Error("Не запрошено")},
    },
  })
  try {
    window.accept({id: "c", history: {revision: 1, total: 1}})
    await tick()
    window.viewport({ids: ["m"], nearStart: false, nearEnd: false, following: true})
    await tick()
    expect(window.getSnapshot().rows[0]).toMatchObject({body: "newer", header: {revision: 2}})
    expect(window.getSnapshot().rows[0]?.error).toBeUndefined()
    expect(reads).toBe(1)
  } finally {window.dispose()}
})

test("страница не принимает чужое, дублированное или неограниченное inline содержимое", async () => {
  const body = {conversationId: "c", id: "m", revision: 1, bytes: 10, entry: {text: "Привет"}, evidenceCount: 0}
  for (const bodies of [[{...body, conversationId: "other"}], [body, body], [{...body, entry: {text: "a".repeat(128 * 1024)}}]]) {
    const page: HistoryPage<HistoryHeader, Body> = {conversationId: "c", revision: 1, total: 1, start: 0,
      items: [{id: "m", ordinal: 0, revision: 1, bodyBytes: 10, evidenceCount: 0}], before: null, after: null, bodies}
    const window = createHistoryWindow({changed() {}, isOrdinary: () => true, source: {
      async readPage() {return page}, async readBody() {return body}, async readEvidence() {throw new Error("Не запрошено")},
    }})
    try {
      window.accept({id: "c", history: {revision: 1, total: 1}})
      await tick()
      expect(window.getSnapshot().error).toBeDefined()
      expect(window.getSnapshot().rows).toHaveLength(0)
    } finally {window.dispose()}
  }
})

test("задержанная старая страница не откатывает уже принятое более новое тело", async () => {
  let pageReads = 0
  const gate = Promise.withResolvers<HistoryPage<HistoryHeader, string>>()
  const page: HistoryPage<HistoryHeader, string> = {conversationId: "c", revision: 1, total: 1, start: 0,
    items: [{id: "m", ordinal: 0, revision: 1, bodyBytes: 5, evidenceCount: 0}], before: null, after: null}
  const window = createHistoryWindow({changed() {}, isOrdinary: () => true, source: {
    async readPage() {return ++pageReads === 1 ? page : gate.promise},
    async readBody(conversationId, id) {return {conversationId, id, revision: 2, bytes: 5, entry: "newer", evidenceCount: 0}},
    async readEvidence() {throw new Error("Не запрошено")},
  }})
  try {
    window.accept({id: "c", history: {revision: 1, total: 1}})
    await tick()
    window.tail()
    window.viewport({ids: ["m"], nearStart: false, nearEnd: false, following: true})
    await tick()
    expect(window.getSnapshot().rows[0]?.body).toBe("newer")
    gate.resolve({...page, bodies: [{conversationId: "c", id: "m", revision: 1, bytes: 3, entry: "old", evidenceCount: 0}]})
    await tick()
    expect(window.getSnapshot().rows[0]).toMatchObject({body: "newer", header: {revision: 2}})
  } finally {window.dispose()}
})

test("новый summary не помечается прочитанным до получения хвоста, если человек начал читать прошлое", async () => {
  let reads = 0
  const gate = Promise.withResolvers<HistoryPage<HistoryHeader, string>>()
  const page: HistoryPage<HistoryHeader, string> = {conversationId: "c", revision: 1, total: 1, start: 0,
    items: [{id: "m", ordinal: 0, revision: 1, bodyBytes: 1, evidenceCount: 0}], before: null, after: null,
    bodies: [{conversationId: "c", id: "m", revision: 1, bytes: 1, entry: "A", evidenceCount: 0}]}
  const window = createHistoryWindow({changed() {}, isOrdinary: () => true, source: {
    async readPage() {return ++reads === 1 ? page : gate.promise},
    async readBody() {throw new Error("Не запрошено")}, async readEvidence() {throw new Error("Не запрошено")},
  }})
  try {
    window.accept({id: "c", history: {revision: 1, total: 1}})
    await tick()
    window.accept({id: "c", history: {revision: 2, total: 2}})
    window.viewport({ids: ["m"], nearStart: false, nearEnd: false, following: true})
    window.viewport({ids: ["m"], nearStart: false, nearEnd: false, following: false})
    expect(window.getSnapshot().unread).toBe(1)
    gate.resolve({...page, revision: 2, total: 2})
    await tick()
    expect(window.getSnapshot().unread).toBe(1)
    expect(window.getSnapshot().following).toBeFalse()
  } finally {window.dispose()}
})
