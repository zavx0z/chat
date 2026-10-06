/**
Управляет ограниченным окном истории одной беседы. Страницы и содержимое
принадлежат backend приложения; представление сообщает только видимый диапазон.
Скрытие освобождает payload и возвращается к прежнему месту при раскрытии.

@packageDocumentation
*/
import type {HistoryController} from "./contract/controller"
import type {HistoryHeader} from "./contract/header"
import type {HistoryInput} from "./contract/options"
import type {HistoryBody} from "./contract/body"
import type {HistoryPage} from "./contract/page"
import type {HistoryEvidencePage} from "./contract/evidence-page"
import type {HistoryQuery} from "./contract/query"
import type {HistorySelection} from "./contract/selection"
import type {HistoryViewport} from "./contract/viewport"
import type {HistoryResidencyBudget} from "./contract/residency-budget"

export type {HistoryController} from "./contract/controller"
export type {HistoryHeader} from "./contract/header"
export type {HistoryInput} from "./contract/options"
export type {HistoryBody} from "./contract/body"
export type {HistoryPage} from "./contract/page"
export type {HistoryEvidencePage} from "./contract/evidence-page"
export type {HistoryQuery} from "./contract/query"
export type {HistorySelection} from "./contract/selection"
export type {HistorySummary} from "./contract/summary"
export type {HistorySource} from "./contract/source"
export type {HistoryRow} from "./contract/row"
export type {HistoryView} from "./contract/view"
export type {HistoryViewport} from "./contract/viewport"
export type {HistoryResidencyBudget} from "./contract/residency-budget"

export type {ChatConversationHistory} from "./contract"

const CACHE_BYTES = 4 * 1024 * 1024
const MAX_BODY_BYTES = 16 * 1024 * 1024
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0

/** Один бюджет для верхнего и вложенных окон: 4 MiB обычных данных и одно тело до 16 MiB суммарно. */
export function createHistoryResidencyBudget(): HistoryResidencyBudget {
  const entries = new Map<symbol, {regular: number; large: number; evict(): void}>()
  const usage = () => {
    let regularBytes = 0
    let largeBytes = 0
    let largeCount = 0
    for (const entry of entries.values()) {regularBytes += entry.regular; largeBytes += entry.large; largeCount += Number(entry.large > 0)}
    return {regularBytes, largeBytes, largeCount, entries: entries.size}
  }
  const release = (key: symbol) => {entries.delete(key)}
  return {
    usage, release,
    reserve(key, bodyBytes, evidenceBytes, evict) {
      if (![bodyBytes, evidenceBytes].every(bytes => integer(bytes) && bytes <= MAX_BODY_BYTES)) return false
      const regular = (bodyBytes <= CACHE_BYTES ? bodyBytes : 0) + (evidenceBytes <= CACHE_BYTES ? evidenceBytes : 0)
      const large = Math.max(bodyBytes > CACHE_BYTES ? bodyBytes : 0, evidenceBytes > CACHE_BYTES ? evidenceBytes : 0)
      if (regular > CACHE_BYTES || bodyBytes > CACHE_BYTES && evidenceBytes > CACHE_BYTES) return false
      entries.delete(key)
      if (large > 0) for (const [other, entry] of [...entries]) {
        if (entry.large === 0) continue
        entries.delete(other)
        entry.evict()
      }
      for (const [other, entry] of [...entries]) {
        if (usage().regularBytes + regular <= CACHE_BYTES) break
        if (entry.regular === 0) continue
        entries.delete(other)
        entry.evict()
      }
      entries.set(key, {regular, large, evict})
      return true
    },
  }
}

/**
Окно одной выбранной беседы, независимое от её авторов и backend. Заголовки ограничены тремя страницами,
body/evidence единым byte budget. Visibility/collapse отзывает запрос и strong refs;
поздний результат не может восстановить закрытую либо другую беседу.
Если host создаёт вложенные окна, общий residencyBudget ограничивает сумму их
сохранённых body/evidence; создание окна само не читает источник и не публикует состояние.
Измеренная row.visible остаётся независимой от revision и загрузки тела.
*/
export function createHistoryWindow<Header extends HistoryHeader, Body, Evidence>(input: HistoryInput<Header, Body, Evidence>): HistoryController<Header, Body, Evidence> {
  const pageSize = Math.max(1, Math.min(32, input.pageSize ?? 32))
  const maxPages = Math.max(1, Math.min(3, input.maxPages ?? 3))
  type Page = HistoryPage<Header>
  type Stored = {body: HistoryBody<Body>, evidence?: HistoryEvidencePage<Evidence>, evidenceBytes: number, touched: number}
  let selected: HistorySelection | null = null
  let active = true
  let disposed = false
  let generation = 0
  let following = true
  let readTotal = 0
  let readRevision = 0
  let pages: Page[] = []
  let pageRequest: AbortController | null = null
  let pageAgain = false
  let pendingPage: {query: HistoryQuery; direction: "before" | "after" | "tail"} | undefined
  let error: string | undefined
  let failedPage: {query: HistoryQuery, direction: "before" | "after" | "tail"} | undefined
  let clock = 0
  let viewportKey = ""
  let resumeOrdinal: number | undefined
  const visible = new Set<string>()
  const expanded = new Set<string>()
  const cache = new Map<string, Stored>()
  const allocations = new Map<string, symbol>()
  const requests = new Map<string, AbortController>()
  const requestRevisions = new Map<string, number>()
  const failures = new Map<string, {message: string; revision: number}>()
  const blocked = new Set<string>()
  const headers = () => [...new Map(pages.flatMap(page => page.items).map(item => [item.id, item])).values()].sort((a, b) => a.ordinal - b.ordinal)
  const needed = (id: string) => active && visible.has(id) && headers().some(header => header.id === id && (input.isOrdinary(header) || expanded.has(id)))
  const changed = () => {if (!disposed) input.changed()}
  const releaseAllocation = (id: string) => {
    const key = allocations.get(id)
    if (key !== undefined) input.residencyBudget?.release(key)
    allocations.delete(id)
  }
  const cancelDetails = (id: string) => {
    releaseAllocation(id)
    requests.get(id)?.abort()
    requests.delete(id)
    requestRevisions.delete(id)
    cache.delete(id)
    failures.delete(id)
    blocked.delete(id)
  }
  const release = () => {
    generation++
    viewportKey = ""
    pageRequest?.abort()
    pageRequest = null
    pageAgain = false
    pendingPage = undefined
    failedPage = undefined
    for (const request of requests.values()) request.abort()
    requests.clear()
    requestRevisions.clear()
    pages = []
    for (const id of allocations.keys()) releaseAllocation(id)
    cache.clear()
    visible.clear()
    expanded.clear()
    failures.clear()
    blocked.clear()
    error = undefined
  }
  const valid = (epoch: number, chatId: string) => !disposed && active && epoch === generation && selected?.id === chatId
  const trim = () => {
    for (const [id] of cache) if (!needed(id)) cancelDetails(id)
  }
  const usage = (body: number, evidence: number) => ({regular: (body <= CACHE_BYTES ? body : 0) + (evidence <= CACHE_BYTES ? evidence : 0), large: Number(body > CACHE_BYTES) + Number(evidence > CACHE_BYTES)})
  const makeRoom = (id: string, bytes: number, evidence = false): boolean => {
    if (bytes > MAX_BODY_BYTES) return false
    const stored = cache.get(id)
    const incoming = usage(evidence ? stored?.body.bytes ?? 0 : bytes, evidence ? bytes : 0)
    if (incoming.large > 1 || incoming.regular > CACHE_BYTES) return false
    for (const [key, cached] of cache) if (key !== id && incoming.large > 0 && usage(cached.body.bytes, cached.evidenceBytes).large > 0) {
      cancelDetails(key)
      blocked.add(key)
    }
    let total = [...cache].filter(([key]) => key !== id).reduce((sum, [, cached]) => sum + usage(cached.body.bytes, cached.evidenceBytes).regular, 0)
    for (const [key, cached] of [...cache].sort((a, b) => a[1].touched - b[1].touched)) {
      if (total + incoming.regular <= CACHE_BYTES) break
      if (key === id) continue
      total -= usage(cached.body.bytes, cached.evidenceBytes).regular
      cancelDetails(key)
      blocked.add(key)
    }
    if (total + incoming.regular > CACHE_BYTES) return false
    if (input.residencyBudget !== undefined) {
      const key = allocations.get(id) ?? Symbol(id)
      const reserved = input.residencyBudget.reserve(key, evidence ? stored?.body.bytes ?? 0 : bytes, evidence ? bytes : 0, () => {
        cancelDetails(id)
        blocked.add(id)
        changed()
      })
      if (!reserved) return false
      allocations.set(id, key)
    }
    return true
  }
  const pump = () => {
    if (selected === null || !active || disposed) return
    if (pageRequest === null && pendingPage !== undefined && requests.size < 4) {
      const pending = pendingPage
      pendingPage = undefined
      void load(pending.query, pending.direction)
    }
    for (const header of headers()) {
      if (requests.size + Number(pageRequest !== null) >= 4) break
      if (!needed(header.id) || cache.has(header.id) || requests.has(header.id) || failures.has(header.id) || blocked.has(header.id)) continue
      const controller = new AbortController()
      const epoch = generation
      const chatId = selected.id
      requests.set(header.id, controller)
      requestRevisions.set(header.id, header.revision)
      void input.source.readBody(chatId, header.id, controller.signal).then(value => {
        if (!valid(epoch, chatId) || controller.signal.aborted || requests.get(header.id) !== controller || !needed(header.id)) return
        const body = value
        if (!body || body.conversationId !== chatId || body.id !== header.id || !integer(body.revision) || !integer(body.bytes) || body.bytes > MAX_BODY_BYTES ||
          body.revision !== headers().find(item => item.id === header.id)?.revision) throw new Error("Устаревшее или некорректное тело истории")
        const entry = input.validateBody?.(body.entry, header) ?? body.entry
        if (makeRoom(header.id, body.bytes)) cache.set(header.id, {body: {...body, entry}, evidenceBytes: 0, touched: ++clock})
        else blocked.add(header.id)
      }).catch(failure => {
        if (valid(epoch, chatId) && !controller.signal.aborted) failures.set(header.id, {message: failure instanceof Error ? failure.message : String(failure), revision: header.revision})
      }).finally(() => {
        if (requests.get(header.id) === controller) {requests.delete(header.id); requestRevisions.delete(header.id)}
        if (valid(epoch, chatId)) {changed(); pump()}
      })
    }
  }
  const load = async (query: HistoryQuery = {}, direction: "before" | "after" | "tail" = "tail") => {
    if (selected === null || !active || disposed) return
    if (pageRequest !== null) {if (direction === "tail") pageAgain = true; return}
    if (requests.size >= 4) {pendingPage = {query, direction}; return}
    const epoch = generation
    const chatId = selected.id
    const controller = new AbortController()
    pageRequest = controller
    error = undefined
    changed()
    try {
      const page = await input.source.readPage(chatId, {limit: pageSize, maxBytes: 65536, ...query}, controller.signal)
      if (!valid(epoch, chatId) || controller.signal.aborted) return
      if (!page || page.conversationId !== chatId || !integer(page.revision) || !integer(page.total) || !integer(page.start) || !Array.isArray(page.items) || page.items.length > pageSize ||
        page.items.some(header => !header || typeof header.id !== "string" || !integer(header.ordinal) || !integer(header.revision) || !integer(header.bodyBytes) || !integer(header.evidenceCount) || input.validateHeader?.(header) === false) ||
        new TextEncoder().encode(JSON.stringify(page.items)).byteLength > 65536) throw new Error("Некорректная страница истории")
      failedPage = undefined
      pages = direction === "tail" ? [page] : [...pages.filter(existing => existing.start !== page.start), page].sort((a, b) => a.start - b.start)
      if (pages.length > maxPages) pages = direction === "before" ? pages.slice(0, maxPages) : pages.slice(-maxPages)
      // Та же геометрия после чтения страницы теперь соответствует доступным заголовкам.
      // Ранний viewport мог прийти, пока они ещё отсутствовали, и не запустить тела.
      viewportKey = ""
      const current = new Map(headers().map(header => [header.id, header]))
      for (const id of expanded) if (!current.has(id)) expanded.delete(id)
      for (const id of visible) if (!current.has(id)) {visible.delete(id); cancelDetails(id)}
      for (const [id, failure] of failures) if (current.get(id)?.revision !== failure.revision) cancelDetails(id)
      for (const id of blocked) if (!current.has(id)) blocked.delete(id)
      for (const [id, stored] of cache) if (current.get(id)?.revision !== stored.body.revision) cancelDetails(id)
      for (const [id] of requests) if (current.get(id)?.revision !== requestRevisions.get(id)) cancelDetails(id)
      trim()
      if (following) {readTotal = selected.history.total; readRevision = selected.history.revision}
      pump()
    } catch (failure) {
      if (valid(epoch, chatId) && !controller.signal.aborted) {failedPage = {query, direction}; error = failure instanceof Error ? failure.message : String(failure)}
    } finally {
      if (pageRequest === controller) pageRequest = null
      if (valid(epoch, chatId)) {
        changed()
        if (pageAgain && following) {pageAgain = false; void load()}
        else pump()
      }
    }
  }
  return {
    getSnapshot() {
      return {conversationId: selected?.id ?? null, revision: selected?.history.revision ?? 0, total: selected?.history.total ?? 0,
        rows: headers().map(header => ({header, visible: visible.has(header.id), body: cache.get(header.id)?.body.entry, evidence: cache.get(header.id)?.evidence,
          expanded: expanded.has(header.id), loading: requests.has(header.id), error: failures.get(header.id)?.message})),
        before: pages[0]?.before ?? null, after: pages.at(-1)?.after ?? null, unread: following ? 0 : Math.max(0, (selected?.history.total ?? 0) - readTotal, (selected?.history.revision ?? 0) > readRevision ? 1 : 0),
        following, loading: pageRequest !== null, error}
    },
    accept(snapshot: HistorySelection) {
      const previous = selected
      const reset = previous === null || previous.id !== snapshot.id || previous.scope !== snapshot.scope
      if (reset) {release(); resumeOrdinal = undefined; following = true; readTotal = snapshot.history.total; readRevision = snapshot.history.revision}
      selected = snapshot
      if (snapshot.history.total === 0) {pages = []; trim(); return}
      if (active && (reset || following && previous?.history.revision !== snapshot.history.revision)) void load()
    },
    setActive(value: boolean) {
      if (active === value || disposed) return
      active = value
      if (!value) release()
      else if (selected !== null && selected.history.total > 0) void load(!following && resumeOrdinal !== undefined ? {around: resumeOrdinal} : {})
      changed()
    },
    viewport(viewport: HistoryViewport) {
      if (disposed || !active) return
      const key = JSON.stringify(viewport)
      if (key === viewportKey) return
      viewportKey = key
      resumeOrdinal = headers().find(header => viewport.ids.includes(header.id))?.ordinal ?? resumeOrdinal
      const previous = new Set(visible)
      visible.clear()
      const available = new Set(headers().map(header => header.id))
      for (const id of viewport.ids) if (available.has(id)) visible.add(id)
      for (const id of previous) if (!visible.has(id)) cancelDetails(id)
      for (const id of visible) if (!previous.has(id)) blocked.delete(id)
      following = viewport.following
      if (following) {readTotal = selected?.history.total ?? 0; readRevision = selected?.history.revision ?? 0}
      trim()
      pump()
      if (viewport.nearStart && pages[0]?.before != null) void load({before: pages[0].before}, "before")
      else if (viewport.nearEnd && pages.at(-1)?.after != null) void load({after: pages.at(-1)!.after!}, "after")
      changed()
    },
    expand(id: string, value: boolean) {
      if (!headers().some(header => header.id === id)) return
      if (value) expanded.add(id)
      else {expanded.delete(id); cancelDetails(id)}
      blocked.delete(id)
      pump()
      changed()
    },
    retry(id: string) {
      failures.delete(id)
      blocked.delete(id)
      const page = pages.find(page => page.items.some(header => header.id === id))
      if (page && selected && page.revision !== selected.history.revision) {
        // Чтение прошлого не прыгает в хвост: уточняем заголовок той же страницы.
        void load(page.start === 0 ? {around: 0} : {after: page.start - 1}, page === pages[0] ? "before" : "after")
      } else pump()
      changed()
    },
    retryPage() {if (failedPage) void load(failedPage.query, failedPage.direction); else void load()},
    tail() {following = true; readTotal = selected?.history.total ?? 0; readRevision = selected?.history.revision ?? 0; void load()},
    async evidence(id: string, after?: number) {
      const stored = cache.get(id)
      if (!stored || selected === null || !needed(id) || requests.has(id) || requests.size + Number(pageRequest !== null) >= 4) return
      const controller = new AbortController()
      const epoch = generation
      const chatId = selected.id
      requests.set(id, controller)
      requestRevisions.set(id, stored.body.revision)
      changed()
      try {
        const page = await input.source.readEvidence(chatId, id, {limit: 32, maxBytes: 131072, ...(after === undefined ? {} : {after})}, controller.signal)
        if (!valid(epoch, chatId) || controller.signal.aborted || cache.get(id) !== stored || !needed(id)) return
        if (!page || page.conversationId !== chatId || page.id !== id || page.revision !== stored.body.revision || !Array.isArray(page.items) || page.items.length > 32) throw new Error("Некорректная страница evidence")
        const bytes = new TextEncoder().encode(JSON.stringify(page)).byteLength
        if (bytes > MAX_BODY_BYTES || bytes > 131072 && page.items.length !== 1 || !makeRoom(id, bytes, true)) throw new Error("Страница evidence превышает бюджет просмотра")
        stored.evidence = page
        stored.evidenceBytes = bytes
        stored.touched = ++clock
      } catch (failure) {if (valid(epoch, chatId) && !controller.signal.aborted) failures.set(id, {message: failure instanceof Error ? failure.message : String(failure), revision: stored.body.revision})}
      finally {
        if (requests.get(id) === controller) {requests.delete(id); requestRevisions.delete(id)}
        if (valid(epoch, chatId)) {changed(); pump()}
      }
    },
    dispose() {disposed = true; release(); selected = null},
  }
}
