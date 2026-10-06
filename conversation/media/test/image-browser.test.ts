import {expect, test} from "bun:test"
import {createMediaImageCache, prepareMediaImage, type ImagePreparationHost} from "../browser"

function fixture(width = 6000, height = 4000) {
  const decoded: Blob[] = []
  const canvases: {width: number, height: number}[] = []
  const urls: string[] = []
  const revoked: string[] = []
  let closed = 0
  let active = 0
  let maximum = 0
  let hold: ReturnType<typeof Promise.withResolvers<void>> | undefined
  let encoding: ReturnType<typeof Promise.withResolvers<Blob>> | undefined
  const host: ImagePreparationHost = {
    async decode(blob) {
      decoded.push(blob)
      active += 1
      maximum = Math.max(maximum, active)
      try { await hold?.promise } finally { active -= 1 }
      return {width, height, close() { closed += 1 }} as ImageBitmap
    },
    canvas(canvasWidth, canvasHeight) {
      const canvas = {width: canvasWidth, height: canvasHeight, getContext() { return {drawImage() {}} },
        async convertToBlob() { return encoding?.promise ?? new Blob([new Uint8Array([1, 2])], {type: "image/webp"}) }}
      canvases.push(canvas)
      return canvas as unknown as OffscreenCanvas
    },
    createUrl() {
      const url = `blob:prepared-${urls.length}`
      urls.push(url)
      return url
    },
    revokeUrl(url) { revoked.push(url) },
    async fetchUrl() { return new Response(new Blob([new Uint8Array([1])], {type: "image/png"})) },
  }
  return {host, decoded, canvases, urls, revoked, closed: () => closed, maximum: () => maximum,
    hold() {
      hold = Promise.withResolvers<void>()
      return hold
    },
    encoding() {
      encoding = Promise.withResolvers<Blob>()
      return encoding
    },
  }
}

const source = new Blob([new Uint8Array([1])], {type: "image/png"})

test("thumbnail и full preview сохраняют aspect, viewport/DPR и pixel caps; ресурсы освобождаются", async () => {
  const f = fixture()
  const thumb = await prepareMediaImage({source, mode: "thumbnail", maxEdge: 9000, host: f.host})
  const capped = await prepareMediaImage({source, mode: "preview", maxEdge: 9000, host: f.host})
  const full = await prepareMediaImage({source, mode: "preview", viewport: {width: 800, height: 600, dpr: 2}, host: f.host})
  expect(thumb).toMatchObject({width: 512, height: 341})
  expect(capped).toMatchObject({width: 2048, height: 1365})
  expect(full).toMatchObject({width: 1600, height: 1066})
  expect(f.closed()).toBe(3)
  expect(f.canvases.map(canvas => [canvas.width, canvas.height])).toEqual([[0, 0], [0, 0], [0, 0]])
  expect(f.revoked).toEqual([])
  thumb!.release()
  thumb!.release()
  capped!.release()
  full!.release()
  expect(f.revoked).toEqual(f.urls)
})

test("одновременно работает один decode, queued abort не начинает чтение и late bitmap закрывается", async () => {
  const f = fixture()
  const gate = f.hold()
  const firstAbort = new AbortController()
  const queuedAbort = new AbortController()
  const first = prepareMediaImage({source, mode: "thumbnail", host: f.host, signal: firstAbort.signal})
  const queued = prepareMediaImage({source, mode: "thumbnail", host: f.host, signal: queuedAbort.signal})
  const last = prepareMediaImage({source, mode: "thumbnail", host: f.host})
  await Bun.sleep(0)
  expect(f.decoded).toHaveLength(1)
  queuedAbort.abort()
  expect(await queued).toBeNull()
  firstAbort.abort()
  gate.resolve()
  expect(await first).toBeNull()
  const result = await last
  expect(f.maximum()).toBe(1)
  expect(f.decoded).toHaveLength(2)
  expect(f.closed()).toBe(2)
  expect(f.urls).toHaveLength(1)
  result!.release()
})

test("сохранённый generic image/base64 и browser blob URL проходят тот же bounded prepare", async () => {
  const f = fixture(40, 30)
  const attachment = {id: "saved", name: "Картинка.png", mimeType: "image/png", bytes: 3, kind: "image" as const, data: "AQID"}
  const saved = await prepareMediaImage({source: attachment, mode: "thumbnail", host: f.host})
  const selected = await prepareMediaImage({source: "blob:original", mode: "preview", host: f.host})
  expect(saved).toMatchObject({width: 40, height: 30})
  expect(new Uint8Array(await f.decoded[0]!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  expect(f.decoded[0]!.type).toBe("image/png")
  expect(selected).toMatchObject({width: 40, height: 30})
  saved!.release()
  selected!.release()
})

test("stale encode не создаёт late URL; image queue и source sizes ограничены до decode", async () => {
  const f = fixture()
  const encode = f.encoding()
  let current = true
  const pending = prepareMediaImage({source, mode: "thumbnail", host: f.host, isCurrent: () => current})
  await Bun.sleep(0)
  current = false
  encode.resolve(new Blob(["thumb"]))
  expect(await pending).toBeNull()
  expect(f.urls).toEqual([])
  expect(f.closed()).toBe(1)
  await expect(prepareMediaImage({source: {id: "large", name: "large", mimeType: "image/png", bytes: 0, kind: "image", data: "x".repeat(16 * 1024 * 1024 + 1)}, mode: "thumbnail", host: f.host})).rejects.toThrow("источник")
  expect(f.decoded).toHaveLength(1)
  const busy = fixture()
  const gate = busy.hold()
  const active = prepareMediaImage({source, mode: "thumbnail", host: busy.host})
  const abort = new AbortController()
  const waiting = Array.from({length: 16}, () => prepareMediaImage({source, mode: "thumbnail", host: busy.host, signal: abort.signal}))
  await expect(prepareMediaImage({source, mode: "thumbnail", host: busy.host})).rejects.toThrow("Очередь")
  abort.abort()
  expect((await Promise.all(waiting)).every(value => value === null)).toBeTrue()
  gate.resolve()
  const result = await active
  result!.release()
})


test("ошибка кодирования закрывает bitmap/canvas и освобождает глобальный decode slot", async () => {
  const broken = fixture()
  const encode = broken.encoding()
  const pending = prepareMediaImage({source, mode: "thumbnail", host: broken.host})
  await Bun.sleep(0)
  encode.reject(new Error("Не удалось кодировать"))
  await expect(pending).rejects.toThrow("Не удалось кодировать")
  expect(broken.closed()).toBe(1)
  expect(broken.canvases.map(canvas => [canvas.width, canvas.height])).toEqual([[0, 0]])
  expect(broken.urls).toEqual([])
  const healthy = fixture()
  const result = await prepareMediaImage({source, mode: "thumbnail", host: healthy.host})
  expect(result).not.toBeNull()
  result!.release()
})


test("loader не загружает originals до свободного slot, queued cancellation не вызывает IO", async () => {
  const f = fixture()
  const gate = f.hold()
  const loaded: string[] = []
  const abort = new AbortController()
  const prepare = (id: string, signal?: AbortSignal) => prepareMediaImage({
    source: `chat-media:${id}`, mode: "thumbnail", host: f.host, ...(signal ? {signal} : {}),
    loader: async current => {current.throwIfAborted(); loaded.push(id); return source},
  })
  const first = prepare("first")
  const cancelled = prepare("cancelled", abort.signal)
  const last = prepare("last")
  await Bun.sleep(0)
  expect(loaded).toEqual(["first"])
  abort.abort()
  expect(await cancelled).toBeNull()
  expect(loaded).toEqual(["first"])
  gate.resolve()
  const results = await Promise.all([first, last])
  expect(loaded).toEqual(["first", "last"])
  for (const image of results) image?.release()
})

test("слишком большой loader Blob отвергается до decoder и освобождает slot", async () => {
  const f = fixture()
  await expect(prepareMediaImage({source: "chat-media:large", mode: "thumbnail", host: f.host,
    loader: async () => new Blob([new Uint8Array(16 * 1024 * 1024 + 1)]),
  })).rejects.toThrow("16 МиБ")
  expect(f.decoded).toHaveLength(0)
  const next = await prepareMediaImage({source, mode: "thumbnail", host: f.host})
  expect(next).not.toBeNull()
  next?.release()
})


test("stable thumbnail повторно используется без original IO/decode, URL принадлежит всем active leases", async () => {
  const f = fixture()
  const cache = createMediaImageCache()
  let loads = 0
  const options = {source: "chat-media:stable", mode: "thumbnail" as const, host: f.host, cache,
    loader: async () => {loads++; return source}}
  const first = await prepareMediaImage(options)
  const second = await prepareMediaImage(options)
  expect(loads).toBe(1)
  expect(f.decoded).toHaveLength(1)
  expect(second!.url).toBe(first!.url)
  first!.release()
  expect(f.revoked).toHaveLength(0)
  second!.release()
  expect(f.revoked).toHaveLength(1)
  const restored = await prepareMediaImage(options)
  expect(loads).toBe(1)
  expect(f.decoded).toHaveLength(1)
  restored!.release()
  cache.invalidate(options.source)
  const retried = await prepareMediaImage(options)
  expect(loads).toBe(2)
  retried!.release()
  cache.dispose()
  expect(cache.inspect()).toMatchObject({entries: 0, bytes: 0, activeLeases: 0, retiredBytes: 0, uncachedBytes: 0})
})

test("thumbnail cache ограничен 64 entries/8MiB, eviction/dispose не отзывают URL активного reader", async () => {
  const f = fixture()
  const cache = createMediaImageCache()
  for (let index = 0; index < 65; index++) {
    const value = await prepareMediaImage({source: `chat-media:${index}`, mode: "thumbnail", host: f.host, cache, loader: async () => source})
    value!.release()
  }
  expect(cache.inspect().entries).toBe(64)
  cache.dispose()
  const bounded = createMediaImageCache()
  const big = new Blob([new Uint8Array(4 * 1024 * 1024)])
  const a = bounded.put("a", "a", big, 512, 512, f.host)
  const b = bounded.put("b", "b", big, 512, 512, f.host)
  const c = bounded.put("c", "c", big, 512, 512, f.host)
  expect(bounded.inspect()).toMatchObject({entries: 2, bytes: 8 * 1024 * 1024, uncachedBytes: 4 * 1024 * 1024})
  bounded.dispose()
  expect(f.revoked).not.toContain(a.url)
  a.release()
  b.release()
  c.release()
  expect(bounded.inspect()).toMatchObject({entries: 0, bytes: 0, activeLeases: 0, retiredBytes: 0, uncachedBytes: 0})
})


test("clear во время loader не возвращает cache retention, следующий visible request может кешироваться", async () => {
  const f = fixture()
  const cache = createMediaImageCache()
  const gate = f.hold()
  const options = {source: "chat-media:hidden", mode: "thumbnail" as const, host: f.host, cache, loader: async () => source}
  const pending = prepareMediaImage(options)
  await Bun.sleep(0)
  cache.clear()
  gate.resolve()
  const active = await pending
  expect(cache.inspect()).toMatchObject({entries: 0, bytes: 0, uncachedBytes: 2})
  active!.release()
  const visible = await prepareMediaImage(options)
  expect(cache.inspect()).toMatchObject({entries: 1, bytes: 2})
  visible!.release()
  cache.dispose()
})


test("два queued reader одного source разделяют подготовленный вариант без второго loader", async () => {
  const f = fixture()
  const cache = createMediaImageCache()
  const gate = f.hold()
  let loads = 0
  const options = {source: "chat-media:coalesced", mode: "thumbnail" as const, host: f.host, cache,
    loader: async () => {loads++; return source}}
  const first = prepareMediaImage(options)
  const second = prepareMediaImage(options)
  await Bun.sleep(0)
  expect(loads).toBe(1)
  gate.resolve()
  const leases = await Promise.all([first, second])
  expect(loads).toBe(1)
  expect(f.decoded).toHaveLength(1)
  expect(leases[0]!.url).toBe(leases[1]!.url)
  cache.clear()
  expect(f.revoked).toHaveLength(0)
  leases[0]!.release()
  expect(f.revoked).toHaveLength(0)
  leases[1]!.release()
  expect(f.revoked).toHaveLength(1)
  expect(cache.inspect()).toMatchObject({activeLeases: 0, retiredBytes: 0})
})

test("variant identity различает mode, fullscreen viewport и DPR", async () => {
  const f = fixture()
  const cache = createMediaImageCache()
  let loads = 0
  const common = {source: "chat-media:geometry", host: f.host, cache, loader: async () => {loads++; return source}}
  const thumbnail = await prepareMediaImage({...common, mode: "thumbnail"})
  const preview = await prepareMediaImage({...common, mode: "preview", viewport: {width: 100, height: 100, dpr: 1}})
  const retina = await prepareMediaImage({...common, mode: "preview", viewport: {width: 100, height: 100, dpr: 2}})
  const same = await prepareMediaImage({...common, mode: "preview", viewport: {width: 100, height: 100, dpr: 2}})
  expect(thumbnail).toMatchObject({width: 512, height: 341})
  expect(preview).toMatchObject({width: 100, height: 66})
  expect(retina).toMatchObject({width: 200, height: 133})
  expect(same!.url).toBe(retina!.url)
  expect(loads).toBe(3)
  for (const lease of [thumbnail, preview, retina, same]) lease!.release()
  cache.dispose()
})

test("retry одного source не запрещает cache retention другой текущей загрузки", async () => {
  const f = fixture()
  const cache = createMediaImageCache()
  const gate = f.hold()
  const pending = prepareMediaImage({source: "chat-media:active", mode: "thumbnail", host: f.host, cache, loader: async () => source})
  await Bun.sleep(0)
  cache.invalidate("chat-media:unrelated")
  gate.resolve()
  const image = await pending
  expect(cache.inspect()).toMatchObject({entries: 1, bytes: 2})
  image!.release()
  cache.dispose()
})
