/** Изменение сохранённой истории; содержимое записей сюда не входит. */
export type HistorySummary = Readonly<{revision: number; total: number}>

/**
Выбранная беседа. Необязательный scope различает одинаковые id разных источников;
его изменение отзывает запросы и освобождает данные прежнего выбора.
*/
export type HistorySelection = Readonly<{id: string; scope?: string; history: HistorySummary}>

/** Минимальный заголовок. Поля конкретного сообщения предоставляет backend. */
export type HistoryHeader = Readonly<{id: string; ordinal: number; revision: number; bodyBytes: number; evidenceCount: number}>

/** Ordinal задаёт место записи; before/after — исключительные границы. */
export type HistoryQuery = Readonly<{before?: number; after?: number; around?: number; limit?: number; maxBytes?: number}>

/** Страница заголовков в возрастающем порядке ordinal. */
export type HistoryPage<Header extends HistoryHeader> = Readonly<{
  conversationId: string
  revision: number
  total: number
  start: number
  items: readonly Header[]
  before: number | null
  after: number | null
}>

/** Тело одной записи. bytes отражает размер содержимого, а не всего транспорта. */
export type HistoryBody<Body> = Readonly<{
  conversationId: string
  id: string
  revision: number
  bytes: number
  entry: Body
  evidenceCount: number
}>

/** Отдельная страница подробностей одной записи; backend определяет их смысл. */
export type HistoryEvidencePage<Evidence> = Readonly<{
  conversationId: string
  id: string
  revision: number
  total: number
  start: number
  items: readonly Evidence[]
  before: number | null
  after: number | null
}>

/** Видимый диапазон принадлежит представлению, не backend или исполнению автора. */
export type HistoryViewport = Readonly<{ids: readonly string[]; nearStart: boolean; nearEnd: boolean; following: boolean}>

/** Transport и преобразование собственного backend принадлежат приложению. */
export type HistorySource<Header extends HistoryHeader, Body, Evidence> = Readonly<{
  readPage(conversationId: string, query: HistoryQuery, signal: AbortSignal): Promise<HistoryPage<Header>>
  readBody(conversationId: string, id: string, signal: AbortSignal): Promise<HistoryBody<Body>>
  readEvidence(conversationId: string, id: string, query: HistoryQuery, signal: AbortSignal): Promise<HistoryEvidencePage<Evidence>>
}>

/** Содержимое присутствует только у нужных сейчас записей. */
export type HistoryRow<Header extends HistoryHeader, Body, Evidence> = Readonly<{
  header: Header
  body?: Body | undefined
  /** Измеренная видимость строки не зависит от revision её payload. */
  visible?: boolean
  evidence?: HistoryEvidencePage<Evidence> | undefined
  expanded: boolean
  loading: boolean
  error?: string | undefined
}>

/** Ограниченное окно выбранной беседы и состояние его чтения. */
export type HistoryView<Header extends HistoryHeader, Body, Evidence> = Readonly<{
  conversationId: string | null
  revision: number
  total: number
  rows: readonly HistoryRow<Header, Body, Evidence>[]
  before: number | null
  after: number | null
  unread: number
  following: boolean
  loading: boolean
  error?: string | undefined
}>

/**
Источник и смысл записи предоставляет host. isOrdinary разрешает чтение видимого
тела без отдельного раскрытия; validateBody проверяет собственный формат backend.
Контроллер не вводит права пользователей, protocol авторов или хранение истории.
*/
export type HistoryInput<Header extends HistoryHeader, Body, Evidence> = Readonly<{
  source: HistorySource<Header, Body, Evidence>
  isOrdinary(header: Header): boolean
  validateBody?(body: Body, header: Header): Body
  validateHeader?(header: Header): boolean
  /** Один owner передаёт тот же budget всем своим окнам, чтобы лимит не умножался. */
  residencyBudget?: HistoryResidencyBudget
  /** Число заголовков одной страницы и resident страниц; малые вложенные окна используют тот же controller. */
  pageSize?: number
  maxPages?: number
  changed(): void
}>

/**
Окно содержит не больше трёх страниц по 32 заголовка, 4 MiB обычных bodies и
evidence плюс одно большое содержимое до 16 MiB. Не больше четырёх запросов
одновременно; скрытие, collapse и смена беседы abort-ят ненужное чтение.
После eviction возвращение к записи снова читает источник. Общий residencyBudget
применяет эти byte limits к сумме всех окон host, а не к каждому независимо.
Лимиты относятся к сериализованному payload; это не оценка полного JS/GPU/RSS.
*/
export type HistoryController<Header extends HistoryHeader, Body, Evidence> = Readonly<{
  getSnapshot(): HistoryView<Header, Body, Evidence>
  accept(selection: HistorySelection): void
  setActive(active: boolean): void
  viewport(viewport: HistoryViewport): void
  expand(id: string, expanded: boolean): void
  retry(id: string): void
  retryPage(): void
  tail(): void
  evidence(id: string, after?: number): Promise<void>
  dispose(): void
}>

/** Общий бюджет resident payload всех окон одного host, без привязки к протоколу чата. */
export type HistoryResidencyBudget = Readonly<{
  reserve(key: symbol, bodyBytes: number, evidenceBytes: number, evict: () => void): boolean
  release(key: symbol): void
  usage(): Readonly<{regularBytes: number; largeBytes: number; largeCount: number; entries: number}>
}>
