/** Сохраняемое содержимое вложения, независимое от транспорта и provider protocol. */
import {imageDimensions} from "./image-dimensions"

export type MediaAttachment = Readonly<{
  id: string
  name: string
  mimeType: string
  bytes: number
  kind: "image" | "audio" | "file"
  data?: string
  text?: string
}>

/** Preview lease принадлежит только browser draft и не входит в durable attachment. */
export type MediaDraftAttachment = Readonly<{
  attachment: MediaAttachment
  previewUrl?: string
  release(): void
}>

export type MediaReadOptions = Readonly<{
  signal?: AbortSignal
  capabilities?: Readonly<{image?: boolean, audio?: boolean, files?: boolean}> | null
  existing?: readonly MediaDraftAttachment[]
  /** Проверяет поколение draft после ожидания host picker или файлового чтения. */
  isCurrent?(): boolean
}>

/** Только выбор через системный диалог требует native Document. */
export type MediaOptions = MediaReadOptions & Readonly<{browserDocument: Document}>

type FileHandle = {getFile(): Promise<File>}
type HostWindow = Window & {showOpenFilePicker?(options: {multiple: boolean}): Promise<readonly FileHandle[]>}
const MAX_COUNT = 8
const MAX_RAW_BYTES = 8 * 1024 * 1024
const MAX_JSON_BYTES = 16 * 1024 * 1024
const encoder = new TextEncoder()
const current = (options: MediaReadOptions) => !options.signal?.aborted && options.isCurrent?.() !== false
const cancelled = (error: unknown) => error !== null && typeof error === "object" && "name" in error && error.name === "AbortError"

function base64(bytes: Uint8Array): string {
  let binary = ""
  for (let offset = 0; offset < bytes.length; offset += 32_768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768))
  return btoa(binary)
}

/** JSON string budget проверяется до создания потенциально большого escaped текста. */
function textJsonBytes(text: string): number {
  let bytes = 2
  for (const character of text) {
    const code = character.codePointAt(0)!
    bytes += code < 32 ? code === 8 || code === 9 || code === 10 || code === 12 || code === 13 ? 2 : 6 : code === 34 || code === 92 ? 2 : code <= 127 ? 1 : code <= 2047 ? 2 : code <= 65535 ? 3 : 4
    if (bytes > MAX_JSON_BYTES) return bytes
  }
  return bytes
}

function permitted(file: File, options: MediaReadOptions): void {
  const capabilities = options.capabilities
  // Неизвестные capabilities позволяют подготовить draft; явный отрицательный ответ сохраняется.
  if (options.capabilities == null) return
  const supported = file.type.startsWith("image/") ? capabilities?.image : file.type.startsWith("audio/") ? capabilities?.audio : capabilities?.files
  if (!supported) throw new Error("Выбранный агент не поддерживает этот вид вложения")
}

/** Преобразует только ограниченный набор native Files; при отмене не оставляет URLs или draft refs. */
export async function filesToMedia(files: readonly File[], options: MediaReadOptions | MediaOptions): Promise<readonly MediaDraftAttachment[]> {
  if (!current(options)) return []
  const existing = options.existing ?? []
  if (files.length + existing.length > MAX_COUNT) throw new Error("Можно добавить не более 8 вложений")
  let rawBytes = existing.reduce((sum, item) => sum + item.attachment.bytes, 0)
  for (const file of files) {
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.name.length > 512 || file.type.length > 256) throw new Error("Недопустимые сведения вложения")
    rawBytes += file.size
    if (rawBytes > MAX_RAW_BYTES) throw new Error("Общий размер вложений ограничен 8 МиБ")
    permitted(file, options)
  }
  const attachments: MediaDraftAttachment[] = []
  let jsonBytes = encoder.encode(JSON.stringify(existing.map(item => item.attachment))).byteLength
  try {
    for (const file of files) {
      if (!current(options)) break
      const buffer = await file.arrayBuffer()
      if (!current(options)) break
      if (buffer.byteLength !== file.size) throw new Error("Размер вложения изменился при чтении")
      const bytes = new Uint8Array(buffer)
      const id = crypto.randomUUID()
      const label = file.name || "Вложение"
      const mimeType = file.type || "application/octet-stream"
      const common = {id, name: label, mimeType, bytes: file.size}
      let content: MediaAttachment
      if (mimeType.startsWith("image/")) content = {...common, kind: "image", data: base64(bytes)}
      else if (mimeType.startsWith("audio/")) content = {...common, kind: "audio", data: base64(bytes)}
      else {
        let text: string | undefined
        if (mimeType.startsWith("text/") || ["application/json", "application/xml"].includes(mimeType)) {
          try { text = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes) } catch {}
        }
        if (text !== undefined && textJsonBytes(text) + jsonBytes + 4096 <= MAX_JSON_BYTES) content = {...common, kind: "file", text}
        else content = {...common, kind: "file", data: base64(bytes)}
      }
      jsonBytes += encoder.encode(JSON.stringify(content)).byteLength + 1
      if (jsonBytes > MAX_JSON_BYTES) throw new Error("JSON вложений ограничен 16 МиБ")
      let previewUrl: string | undefined = /^(image|audio|video)\//u.test(mimeType) ? URL.createObjectURL(file) : undefined
      const preview = previewUrl
      attachments.push({attachment: content,
        ...(preview === undefined ? {} : {previewUrl: preview}),
        release() {
          if (previewUrl === undefined) return
          URL.revokeObjectURL(previewUrl)
          previewUrl = undefined
        },
      })
    }
    if (!current(options)) {
      for (const item of attachments) item.release()
      return []
    }
    return attachments
  } catch (error) {
    for (const item of attachments) item.release()
    if (!current(options) || cancelled(error)) return []
    throw error
  }
}

/** Native file picker — временная возможность host browser, без второго semantic UI. */
async function inputFiles(options: MediaOptions): Promise<readonly File[]> {
  const document = options.browserDocument
  const input = document.createElement("input")
  input.type = "file"
  input.multiple = true
  input.hidden = true
  document.body.append(input)
  return await new Promise((resolve, reject) => {
    const finish = (files: readonly File[]) => {
      cleanup()
      resolve(files)
    }
    const changed = () => finish([...input.files ?? []])
    const cancel = () => finish([])
    const cleanup = () => {
      input.removeEventListener("change", changed)
      input.removeEventListener("cancel", cancel)
      options.signal?.removeEventListener("abort", cancel)
      input.remove()
    }
    input.addEventListener("change", changed, {once: true})
    input.addEventListener("cancel", cancel, {once: true})
    options.signal?.addEventListener("abort", cancel, {once: true})
    try {
      if (typeof input.showPicker === "function") input.showPicker()
      else input.click()
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}

/** Picker cancellation и stale generation возвращают пустой набор и не являются ошибкой пользователя. */
export async function pickMedia(options: MediaOptions): Promise<readonly MediaDraftAttachment[]> {
  if (!current(options)) return []
  try {
    const window = options.browserDocument.defaultView as HostWindow | null
    const handles = window?.showOpenFilePicker === undefined ? undefined : await window.showOpenFilePicker({multiple: true})
    if (!current(options)) return []
    if (handles !== undefined && handles.length + (options.existing?.length ?? 0) > MAX_COUNT) throw new Error("Можно добавить не более 8 вложений")
    const files: File[] = []
    if (handles === undefined) files.push(...await inputFiles(options))
    else for (const handle of handles) {
      if (!current(options)) return []
      files.push(await handle.getFile())
    }
    return await filesToMedia(files, options)
  } catch (error) {
    if (!current(options) || cancelled(error)) return []
    throw error
  }
}

/** Native host IO для тестирования и browser окружений, без renderer implementation objects. */
export type ImagePreparationHost = Readonly<{
  decode(source: Blob, resize?: Readonly<{resizeWidth: number}>): Promise<ImageBitmap>
  canvas(width: number, height: number): OffscreenCanvas
  createUrl(source: Blob): string
  revokeUrl(url: string): void
  fetchUrl(url: string, signal?: AbortSignal): Promise<Response>
}>

export type ImagePreparationOptions = Readonly<{
  source: Blob | MediaAttachment | string
  /** Выполняется только после получения единственного image slot; ожидающие заявки не загружают originals. */
  loader?: ((signal: AbortSignal) => Promise<Blob>) | undefined
  /** Cache одного авторизованного host; variants используют stable source identity и transform parameters. */
  cache?: MediaImageCache | undefined
  mode: "thumbnail" | "preview"
  maxEdge?: number
  /** Логический viewport с реальным DPR; обе стороны дополнительно ограничивают output. */
  viewport?: Readonly<{width: number, height: number, dpr?: number}>
  signal?: AbortSignal
  isCurrent?(): boolean
  host?: ImagePreparationHost
}>

/** Output lease содержит только подготовленный вариант, исходник и bitmap не удерживаются. */
export type PreparedMediaImage = Readonly<{
  url: string
  width: number
  height: number
  bytes: number
  release(): void
}>

type ImageWaiter = {grant(): void}
const imageWaiters: ImageWaiter[] = []
const MAX_IMAGE_WAITERS = 16
const MAX_IMAGE_SOURCE_BYTES = 16 * 1024 * 1024
let imagePreparing = false
const imageCurrent = (options: ImagePreparationOptions): boolean => !options.signal?.aborted && options.isCurrent?.() !== false

function releaseImageSlot(): void {
  const next = imageWaiters.shift()
  if (next === undefined) imagePreparing = false
  else next.grant()
}

async function imageSlot(options: ImagePreparationOptions): Promise<(() => void) | null> {
  if (!imageCurrent(options)) return null
  if (!imagePreparing) {
    imagePreparing = true
    return releaseImageSlot
  }
  if (imageWaiters.length >= MAX_IMAGE_WAITERS) throw new Error("Очередь подготовки изображений заполнена")
  return await new Promise(resolve => {
    const abort = () => {
      const index = imageWaiters.indexOf(waiter)
      if (index !== -1) imageWaiters.splice(index, 1)
      options.signal?.removeEventListener("abort", abort)
      resolve(null)
    }
    const waiter: ImageWaiter = {grant() {
      options.signal?.removeEventListener("abort", abort)
      if (!imageCurrent(options)) {
        resolve(null)
        releaseImageSlot()
      } else resolve(releaseImageSlot)
    }}
    imageWaiters.push(waiter)
    options.signal?.addEventListener("abort", abort, {once: true})
  })
}

function nativeImageHost(): ImagePreparationHost {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") throw new Error("Browser не предоставляет подготовку изображения")
  return {
    decode: (source, resize) => createImageBitmap(source, {...resize, resizeQuality: "high"}),
    canvas: (width, height) => new OffscreenCanvas(width, height),
    createUrl: source => URL.createObjectURL(source),
    revokeUrl: url => URL.revokeObjectURL(url),
    fetchUrl: (url, signal) => fetch(url, signal === undefined ? {} : {signal}),
  }
}

async function imageSource(options: ImagePreparationOptions, host: ImagePreparationHost): Promise<Blob | null> {
  const source = options.source
  if (source instanceof Blob) {
    if (source.size > MAX_IMAGE_SOURCE_BYTES) throw new Error("Источник изображения ограничен 16 МиБ")
    return source
  }
  if (typeof source !== "string") {
    if (source.kind !== "image" || typeof source.data !== "string" || !source.mimeType.startsWith("image/")) throw new Error("Нужно содержимое изображения")
    if (source.data.length > MAX_IMAGE_SOURCE_BYTES) throw new Error("Base64 изображения ограничен 16 МиБ")
    const binary = atob(source.data)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    return new Blob([bytes], {type: source.mimeType})
  }
  if (!source.startsWith("blob:")) throw new Error("Preview читает только принадлежащий browser blob URL")
  const response = await host.fetchUrl(source, options.signal)
  if (!imageCurrent(options)) return null
  if (!response.ok) throw new Error("Не удалось прочитать изображение")
  const length = Number(response.headers.get("content-length"))
  if (Number.isFinite(length) && length > MAX_IMAGE_SOURCE_BYTES) throw new Error("Источник изображения ограничен 16 МиБ")
  const reader = response.body?.getReader()
  if (reader === undefined) throw new Error("Изображение не содержит потока данных")
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (imageCurrent(options)) {
      const next = await reader.read()
      if (next.done) return new Blob(chunks as BlobPart[], {type: response.headers.get("content-type") ?? "application/octet-stream"})
      bytes += next.value.byteLength
      if (bytes > MAX_IMAGE_SOURCE_BYTES) throw new Error("Источник изображения ограничен 16 МиБ")
      chunks.push(next.value)
    }
    return null
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

function imageLease(host: ImagePreparationHost, url: string, width: number, height: number, bytes: number): PreparedMediaImage {
  let released = false
  return {url, width, height, bytes, release() {
    if (released) return
    released = true
    host.revokeUrl(url)
  }}
}

/** Cache принадлежит одному media host/беседе. Ограничены именно encoded варианты, originals не сохраняются. */
export type MediaImageCache = Readonly<{
  get(key: string, host: ImagePreparationHost): PreparedMediaImage | null
  put(key: string, source: string, blob: Blob, width: number, height: number, host: ImagePreparationHost, stamp?: object): PreparedMediaImage
  stamp(source: string): object
  clear(): void
  invalidate(source: Blob | MediaAttachment | string): void
  dispose(): void
  inspect(): Readonly<{entries: number, bytes: number, activeLeases: number, retiredBytes: number, uncachedBytes: number}>
}>
type CachedImage = {
  key: string
  source: string
  blob: Blob
  width: number
  height: number
  references: number
  retired: boolean
  url?: string
  urlHost?: ImagePreparationHost
}
const MAX_THUMBNAIL_CACHE_BYTES = 8 * 1024 * 1024
const MAX_THUMBNAIL_CACHE_ENTRIES = 64
const IMAGE_TRANSFORM_VERSION = "resample-webp-v1"

function imageSourceIdentity(source: Blob | MediaAttachment | string): string | null {
  if (typeof source === "string") {
    const internal = /^\/__chat_media\/([a-f0-9]{64})$/u.exec(source)
    return internal ? `chat-media:${internal[1]}` : source
  }
  if (source instanceof Blob || typeof source.id !== "string" || source.id.length > 512) return null
  return `attachment:${source.id}:${source.mimeType}:${source.bytes}`
}

/**
LRU удерживает не более 8 МиБ/64 encoded вариантов thumbnail/preview. Активный lease не выселяется:
если все entries заняты, новый thumbnail выдаётся без retention. Эти текущие
отображаемые leases учитываются отдельно в uncachedBytes, а invalidate/dispose
не отзывают URL, ещё используемый другим видимым экземпляром.
*/
export function createMediaImageCache(): MediaImageCache {
  const entries = new Map<string, CachedImage>()
  const retired = new Set<CachedImage>()
  let bytes = 0
  let uncachedBytes = 0
  let activeLeases = 0
  let disposed = false
  const generations = new Map<string, object>()
  const stamp = (source: string): object => {
    const token = generations.get(source) ?? {}
    generations.delete(source)
    generations.set(source, token)
    while (generations.size > MAX_THUMBNAIL_CACHE_ENTRIES) generations.delete(generations.keys().next().value!)
    return token
  }
  const revoke = (entry: CachedImage): void => {
    if (entry.url !== undefined) entry.urlHost!.revokeUrl(entry.url)
    delete entry.url
    delete entry.urlHost
  }
  const remove = (entry: CachedImage): void => {
    entries.delete(entry.key)
    bytes -= entry.blob.size
    entry.retired = true
    if (entry.references === 0) revoke(entry)
    else retired.add(entry)
  }
  const acquire = (entry: CachedImage, host: ImagePreparationHost): PreparedMediaImage => {
    if (entry.url === undefined) {
      entry.url = host.createUrl(entry.blob)
      entry.urlHost = host
    }
    const url = entry.url
    entry.references++
    activeLeases++
    let retained: CachedImage | undefined = entry
    return {url, width: entry.width, height: entry.height, bytes: entry.blob.size, release() {
      const current = retained
      if (!current) return
      retained = undefined
      current.references--
      activeLeases--
      if (current.references === 0) {
        revoke(current)
        retired.delete(current)
      }
    }}
  }
  const uncached = (blob: Blob, width: number, height: number, host: ImagePreparationHost): PreparedMediaImage => {
    const size = blob.size
    const lease = imageLease(host, host.createUrl(blob), width, height, size)
    uncachedBytes += size
    activeLeases++
    let released = false
    return {...lease, release() {
      if (released) return
      released = true
      uncachedBytes -= size
      activeLeases--
      lease.release()
    }}
  }
  const clear = (): void => {
    generations.clear()
    for (const entry of [...entries.values()]) remove(entry)
  }
  return {
    stamp,
    clear,
    get(key, host) {
      if (disposed) return null
      const entry = entries.get(key)
      if (!entry) return null
      entries.delete(key)
      entries.set(key, entry)
      return acquire(entry, host)
    },
    put(key, source, blob, width, height, host, expectedStamp) {
      if (disposed || blob.size > MAX_THUMBNAIL_CACHE_BYTES) return uncached(blob, width, height, host)
      const token = expectedStamp ?? stamp(source)
      if (generations.get(source) !== token) return uncached(blob, width, height, host)
      const existing = entries.get(key)
      if (existing) return acquire(existing, host)
      while (entries.size >= MAX_THUMBNAIL_CACHE_ENTRIES || bytes + blob.size > MAX_THUMBNAIL_CACHE_BYTES) {
        const oldest = [...entries.values()].find(entry => entry.references === 0)
        if (!oldest) return uncached(blob, width, height, host)
        remove(oldest)
      }
      const entry: CachedImage = {key, source, blob, width, height, references: 0, retired: false}
      entries.set(key, entry)
      bytes += blob.size
      return acquire(entry, host)
    },
    invalidate(source) {
      const identity = imageSourceIdentity(source)
      if (identity === null) return
      generations.delete(identity)
      for (const entry of [...entries.values()]) if (entry.source === identity) remove(entry)
    },
    dispose() {
      if (disposed) return
      disposed = true
      clear()
    },
    inspect() {
      return {entries: entries.size, bytes, activeLeases, retiredBytes: [...retired].reduce((sum, entry) => sum + entry.blob.size, 0), uncachedBytes}
    },
  }
}

/**
Подготавливает bounded изображение штатными host API: thumbnail ≤512 px,
fullscreen preview ≤2048 px. Загрузка original и декодирование занимают один общий
slot; ожидающие заявки не запускают loader и ограничены по количеству. Transient OffscreenCanvas служит только resampling
и кодированию Blob; он не является presentation Canvas или вторым semantic UI.

Bitmap и canvas освобождаются до выдачи URL lease. API ограничивает output pixels,
compressed source и retained варианты. PNG/JPEG/GIF/WebP проверяются по доступному
заголовку до decode (до 32 MP); native decode получает целевой resize.
Неизвестный или неполный заголовок проверяется после decode. Это не гарантирует предел peak memory
внутри native decoder: createImageBitmap может сначала декодировать исходный размер.
*/
export async function prepareMediaImage(options: ImagePreparationOptions): Promise<PreparedMediaImage | null> {
  if (!imageCurrent(options)) return null
  if (options.mode !== "thumbnail" && options.mode !== "preview") throw new TypeError("Нужен режим thumbnail либо preview")
  if (options.maxEdge !== undefined && (!Number.isFinite(options.maxEdge) || options.maxEdge <= 0)) throw new TypeError("Размер preview должен быть положительным")
  const maximum = options.mode === "thumbnail" ? 512 : 2048
  const edge = Math.max(1, Math.floor(Math.min(options.maxEdge ?? maximum, maximum)))
  const viewport = options.viewport
  const dpr = viewport?.dpr ?? globalThis.devicePixelRatio ?? 1
  if (viewport !== undefined && (![viewport.width, viewport.height, dpr].every(value => Number.isFinite(value) && value > 0))) throw new TypeError("Нужны положительные размеры viewport и DPR")
  if (options.source instanceof Blob && options.source.size > MAX_IMAGE_SOURCE_BYTES) throw new Error("Источник изображения ограничен 16 МиБ")
  if (typeof options.source === "string" && (options.source.length > 4096 || !options.loader && !options.source.startsWith("blob:"))) throw new Error("Нужен принадлежащий browser blob URL")
  if (!(options.source instanceof Blob) && typeof options.source !== "string" && (typeof options.source.data !== "string" || options.source.data.length > MAX_IMAGE_SOURCE_BYTES || options.source.name.length > 512 || options.source.mimeType.length > 256)) throw new Error("Недопустимый источник изображения")
  const identity = imageSourceIdentity(options.source)
  const cache = identity !== null ? options.cache : undefined
  const key = JSON.stringify([IMAGE_TRANSFORM_VERSION, identity, options.mode, edge, viewport?.width ?? null, viewport?.height ?? null, viewport ? dpr : null])
  const preparationHost = options.host ?? nativeImageHost()
  const cached = cache?.get(key, preparationHost)
  if (cached) return cached
  const generation = cache?.stamp(identity!)
  const releaseSlot = await imageSlot(options)
  if (releaseSlot === null) return null
  let bitmap: ImageBitmap | undefined
  let canvas: OffscreenCanvas | undefined
  let url: string | undefined
  let host: ImagePreparationHost | undefined
  try {
    if (!imageCurrent(options)) return null
    host = preparationHost
    // Другая заявка могла подготовить тот же source, пока эта ожидала slot.
    const shared = cache?.get(key, host)
    if (shared) return shared
    const source = options.loader
      ? await options.loader(options.signal ?? new AbortController().signal)
      : await imageSource(options, host)
    if (source === null || !imageCurrent(options)) return null
    if (!(source instanceof Blob) || source.size > MAX_IMAGE_SOURCE_BYTES) throw new Error("Источник изображения ограничен 16 МиБ")
    const dimensions = await imageDimensions(source)
    if (!imageCurrent(options)) return null
    if (dimensions && (dimensions.width <= 0 || dimensions.height <= 0 || dimensions.width * dimensions.height > 32_000_000)) {
      throw new Error("Изображение превышает 32 мегапикселя. Уменьшите его размер для предпросмотра")
    }
    const decodeScale = dimensions ? Math.min(1, edge / Math.max(dimensions.width, dimensions.height)) : 1
    bitmap = await host.decode(source, dimensions && decodeScale < 1 ? {
      // Одна сторона сохраняет пропорции и при EXIF-повороте native decoder.
      resizeWidth: Math.max(1, Math.floor(Math.min(edge, dimensions.width, dimensions.height))),
    } : undefined)
    if (!imageCurrent(options)) return null
    if (![bitmap.width, bitmap.height].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error("Изображение имеет недопустимые размеры")
    if (bitmap.width * bitmap.height > 32_000_000) throw new Error("Изображение превышает 32 мегапикселя")
    const scale = Math.min(1, edge / bitmap.width, edge / bitmap.height,
      viewport === undefined ? 1 : viewport.width * dpr / bitmap.width,
      viewport === undefined ? 1 : viewport.height * dpr / bitmap.height)
    const width = Math.max(1, Math.floor(bitmap.width * scale))
    const height = Math.max(1, Math.floor(bitmap.height * scale))
    canvas = host.canvas(width, height)
    const context = canvas.getContext("2d")
    if (context === null) throw new Error("Browser не предоставляет resampling изображения")
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await canvas.convertToBlob({type: "image/webp", quality: options.mode === "thumbnail" ? 0.82 : 0.9})
    if (!imageCurrent(options)) return null
    if (blob.size > MAX_IMAGE_SOURCE_BYTES) throw new Error("Подготовленный preview ограничен 16 МиБ")
    if (cache) return cache.put(key, identity!, blob, width, height, host, generation)
    url = host.createUrl(blob)
    const lease = imageLease(host, url, width, height, blob.size)
    url = undefined
    return lease
  } catch (error) {
    if (!imageCurrent(options) || cancelled(error)) return null
    throw error
  } finally {
    bitmap?.close()
    if (canvas !== undefined) {
      canvas.width = 0
      canvas.height = 0
    }
    if (url !== undefined) host?.revokeUrl(url)
    releaseSlot()
  }
}
