import {expect, test} from "bun:test"
import {createRoot} from "@zavx0z/immersive/XReact"
import {createDocument, InputEvent, type HTMLButtonElement, type HTMLInputElement} from "@zavx0z/immersive"
import type {CompiledTemplate} from "@zavx0z/immersive/XReact/compiled"
import Header, {type ChatConversationHeader} from "../index"
import List, {type ChatConversationList} from "../../list"

function fixture() {
  const document = createDocument()
  const host = document.createElement("div")
  document.append(host)
  return {document, host, root: createRoot(host)}
}
const tick = async (root: ReturnType<typeof createRoot>) => {await Promise.resolve(); await Promise.resolve(); root.flush()}

test("имя редактируется с сохранением ввода после отказа и одним запросом до подтверждения", async () => {
  const f = fixture()
  const calls: string[] = []
  const gate = Promise.withResolvers<void>()
  let reject = true
  const props: ChatConversationHeader.Input = {id: "conversation", title: "Первое имя", onRename(title) {
    calls.push(title)
    if (reject) return Promise.reject(new Error("Отказ backend"))
    return gate.promise
  }}
  try {
    f.root.render(Header as unknown as CompiledTemplate<typeof props>, props)
    f.root.flush()
    expect(f.host.textContent).toContain("Первое имя")
    void (f.host.querySelector('button[aria-label="Переименовать беседу"]') as HTMLButtonElement).click()
    f.root.flush()
    const input = (f.host.querySelector("input") as HTMLInputElement)
    input.value = "Новое имя"
    input.dispatchEvent(new InputEvent("input", {bubbles: true, data: "Новое имя", inputType: "insertText"}))
    f.root.flush()
    const save = () => ([...f.host.querySelectorAll("button")] as HTMLButtonElement[]).find(button => button.textContent?.includes("Сохранить"))!
    save().click()
    await tick(f.root)
    expect(f.host.textContent).toContain("Отказ backend")
    expect((f.host.querySelector("input") as HTMLInputElement).value).toBe("Новое имя")
    reject = false
    save().click()
    save().click()
    expect(calls).toEqual(["Новое имя", "Новое имя"])
    gate.resolve()
    await tick(f.root)
    expect(f.host.querySelector("input")).toBeNull()
  } finally {gate.resolve(); f.root.unmount()}
})

test("универсальный список показывает имена и передаёт точные identity без агентной модели", async () => {
  const f = fixture()
  const selected: string[] = []
  const removed: string[] = []
  const gate = Promise.withResolvers<void>()
  let created = 0
  const props: ChatConversationList.Input = {items: [{id: "friends", title: "Друзья"}, {id: "travel", title: "Поездка"}], selectedId: "friends",
    onSelect(id) {selected.push(id)}, onCreate() {created++; return gate.promise}, onRename() {}, onDelete(id) {removed.push(id)}}
  try {
    f.root.render(List as unknown as CompiledTemplate<typeof props>, props)
    f.root.flush()
    void (f.host.querySelector('[data-conversation-id="travel"] button') as HTMLButtonElement).click()
    expect(selected).toEqual(["travel"])
    void (f.host.querySelector('[data-conversation-id="travel"] button[aria-label="В корзину"]') as HTMLButtonElement).click()
    await tick(f.root)
    expect(removed).toEqual(["travel"])
    const create = ([...f.host.querySelectorAll("button")] as HTMLButtonElement[]).find(button => button.textContent?.includes("Новая беседа"))!
    create.click()
    create.click()
    expect(created).toBe(1)
  } finally {gate.resolve(); await tick(f.root); f.root.unmount()}
})

test("большой список имён создаёт только одну страницу элементов", () => {
  const f = fixture()
  const props: ChatConversationList.Input = {items: Array.from({length: 5000}, (_, id) => ({id: String(id), title: `Беседа ${id}`})),
    onSelect() {}, onCreate() {}, onRename() {}, onDelete() {}}
  try {
    f.root.render(List as unknown as CompiledTemplate<typeof props>, props)
    f.root.flush()
    expect(f.host.querySelectorAll("[data-conversation-id]")).toHaveLength(32)
    expect(f.host.querySelector('[data-conversation-id="0"]')).not.toBeNull()
    const next = ([...f.host.querySelectorAll("button")] as HTMLButtonElement[]).find(button => button.textContent?.includes("Следующие беседы"))!
    next.click()
    f.root.flush()
    expect(f.host.querySelectorAll("[data-conversation-id]")).toHaveLength(32)
    expect(f.host.querySelector('[data-conversation-id="0"]')).toBeNull()
    expect(f.host.querySelector('[data-conversation-id="32"]')).not.toBeNull()
  } finally {f.root.unmount()}
})
