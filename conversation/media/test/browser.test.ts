import {expect, test} from "bun:test"
import {filesToMedia, pickMedia} from "../browser"

const document = {} as Document
const options = {browserDocument: document, capabilities: {image: true, audio: true, files: true}}

test("native files дают независимые именованные вложения и принадлежащие preview URLs без persistence", async () => {
  const media = await filesToMedia([
    new File([new Uint8Array([1, 2, 3])], "Картинка.png", {type: "image/png"}),
    new File([new Uint8Array([4, 5])], "Голос.wav", {type: "audio/wav"}),
    new File(["Привет"], "Заметка.txt", {type: "text/plain"}),
    new File([new Uint8Array([0, 255])], "Архив.bin", {type: "application/octet-stream"}),
  ], options)
  try {
    expect(media.map(item => item.attachment.name)).toEqual(["Картинка.png", "Голос.wav", "Заметка.txt", "Архив.bin"])
    expect(media.map(item => item.attachment.kind)).toEqual(["image", "audio", "file", "file"])
    expect(media[0]?.attachment).toMatchObject({kind: "image", data: "AQID", mimeType: "image/png", name: "Картинка.png"})
    expect(media[2]?.attachment).toMatchObject({kind: "file", text: "Привет"})
    expect(media[3]?.attachment).toMatchObject({kind: "file", mimeType: "application/octet-stream", data: "AP8="})
    expect(media[0]?.previewUrl).toStartWith("blob:")
    expect(media[1]?.previewUrl).toStartWith("blob:")
    expect(media[2]?.previewUrl).toBeUndefined()
    expect(new Set(media.map(item => item.attachment.id)).size).toBe(4)
  } finally { for (const item of media) { item.release(); item.release() } }
})

test("count/raw budget и capabilities проверяются до чтения bytes", async () => {
  let reads = 0
  const file = {size: 8 * 1024 * 1024 + 1, name: "Большое.png", type: "image/png", async arrayBuffer() { reads += 1; return new ArrayBuffer(0) }} as File
  await expect(filesToMedia([file], options)).rejects.toThrow("8 МиБ")
  await expect(filesToMedia(Array.from({length: 9}, () => new File([], "Пустой.txt", {type: "text/plain"})), options)).rejects.toThrow("8 вложений")
  await expect(filesToMedia([{...file, size: 1} as File], {browserDocument: document, capabilities: {}})).rejects.toThrow("не поддерживает")
  expect(reads).toBe(0)
})

test("cancel и stale generation не создают late attachments", async () => {
  const waiting = Promise.withResolvers<ArrayBuffer>()
  const file = {size: 1, name: "Поздний.png", type: "image/png", arrayBuffer() { return waiting.promise }} as File
  const abort = new AbortController()
  const pending = filesToMedia([file], {...options, signal: abort.signal})
  abort.abort()
  waiting.resolve(new Uint8Array([1]).buffer)
  expect(await pending).toEqual([])
  let current = true
  const handles = Promise.withResolvers<{getFile(): Promise<File>}[]>()
  const browserDocument = {defaultView: {showOpenFilePicker() { return handles.promise }}} as unknown as Document
  const picker = pickMedia({...options, browserDocument, isCurrent: () => current})
  current = false
  handles.resolve([{async getFile() { throw new Error("stale file must not be read") }}])
  expect(await picker).toEqual([])
  expect(await pickMedia({...options, browserDocument: {defaultView: {async showOpenFilePicker() { throw new DOMException("Отмена", "AbortError") }}} as unknown as Document})).toEqual([])
})

test("большой escaped text переходит в bounded blob без построения JSON больше лимита", async () => {
  const media = await filesToMedia([new File(["\u0000".repeat(4 * 1024 * 1024)], "Нули.txt", {type: "text/plain"})], options)
  try {
    expect(media[0]?.attachment).toMatchObject({kind: "file"})
    expect(media[0]?.attachment).toHaveProperty("data")
    expect(new TextEncoder().encode(JSON.stringify(media.map(item => item.attachment))).byteLength).toBeLessThanOrEqual(16 * 1024 * 1024)
  } finally { for (const item of media) item.release() }
})

test("текстовое вложение сохраняет BOM и original UTF-8 bytes при повторном кодировании", async () => {
  const text = "\uFEFFТекст 🌍\r\n"
  const original = new TextEncoder().encode(text)
  const result = await filesToMedia([new File([original], "note.txt", {type: "text/plain"})], {})
  try {
    expect(result[0]!.attachment.text).toBe(text)
    expect(new TextEncoder().encode(result[0]!.attachment.text)).toEqual(original)
    expect(result[0]!.attachment.bytes).toBe(original.byteLength)
  } finally {for (const item of result) item.release()}
})
