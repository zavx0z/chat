import {expect, test} from "bun:test"
import {createHistoryWindow, createHistoryResidencyBudget} from "../index"

test("верхнее и вложенные окна делят один 4MiB + один16MiB budget; eviction и dispose освобождают claims", async () => {
  const budget = createHistoryResidencyBudget()
  const windows: ReturnType<typeof createHistoryWindow>[] = []
  const make = async (scope: string, bytes: number) => {
    const window = createHistoryWindow({residencyBudget: budget, changed() {}, isOrdinary: () => true,
      source: {
        async readPage(conversationId) {return {conversationId, revision: 1, total: 1, start: 0,
          items: [{id: "shared-id", ordinal: 0, revision: 1, bodyBytes: bytes, evidenceCount: 0}], before: null, after: null}},
        async readBody(conversationId, id) {return {conversationId, id, revision: 1, bytes, entry: "x".repeat(bytes), evidenceCount: 0}},
        async readEvidence() {throw new Error("unused")},
      },
    })
    windows.push(window)
    window.accept({id: "chat", scope, history: {revision: 1, total: 1}})
    await Bun.sleep(0)
    window.viewport({ids: ["shared-id"], nearStart: false, nearEnd: false, following: true})
    await Bun.sleep(0)
    return window
  }
  try {
    const top = await make("top", 3 * 1024 * 1024)
    const groupA = await make("groupA", 3 * 1024 * 1024)
    expect(top.getSnapshot().rows[0]!.body).toBeUndefined()
    expect(groupA.getSnapshot().rows[0]!.body).toBeDefined()
    expect(budget.usage().regularBytes).toBe(3 * 1024 * 1024)
    const largeA = await make("largeA", 5 * 1024 * 1024)
    const largeB = await make("largeB", 6 * 1024 * 1024)
    expect(largeA.getSnapshot().rows[0]!.body).toBeUndefined()
    expect(largeB.getSnapshot().rows[0]!.body).toBeDefined()
    expect(groupA.getSnapshot().rows[0]!.body).toBeDefined()
    expect(budget.usage()).toEqual({regularBytes: 3 * 1024 * 1024, largeBytes: 6 * 1024 * 1024, largeCount: 1, entries: 2})
    largeB.setActive(false)
    expect(budget.usage().largeBytes).toBe(0)
  } finally {for (const window of windows) window.dispose()}
  expect(budget.usage()).toEqual({regularBytes: 0, largeBytes: 0, largeCount: 0, entries: 0})
})

test("тяжёлые раскрытия вытесняют другие подробности, сохраняя малую страницу в том же бюджете", () => {
  const budget = createHistoryResidencyBudget()
  const page = Symbol("page")
  const first = Symbol("first-details")
  const second = Symbol("second-details")
  const evicted: string[] = []
  expect(budget.reserve(page, 64 * 1024, 0, () => evicted.push("page"), true)).toBeTrue()
  expect(budget.reserve(first, 3 * 1024 * 1024, 0, () => evicted.push("first"))).toBeTrue()
  expect(budget.reserve(second, 3 * 1024 * 1024, 0, () => evicted.push("second"))).toBeTrue()
  expect(evicted).toEqual(["first"])
  expect(budget.usage().regularBytes).toBe(64 * 1024 + 3 * 1024 * 1024)
  expect(budget.reserve(Symbol(), 4 * 1024 * 1024, 0, () => {})).toBeFalse()
  expect(evicted).toEqual(["first"])
  expect(budget.usage().entries).toBe(2)
  budget.release(page)
  budget.release(second)
  expect(budget.usage().regularBytes).toBe(0)
})
