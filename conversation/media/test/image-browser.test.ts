import {expect, test} from "bun:test"
import {prepareMediaImage, type ImagePreparationHost} from "../browser"

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
