import {expect, test} from "bun:test"
import {createRoot} from "@zavx0z/immersive-component"
import {createDocument, type HTMLButtonElement} from "@zavx0z/immersive-dom"
import type {CompiledTemplate} from "@zavx0z/immersive-template/compiled"
import List, {type ChatConversationList} from "../index"

test("корзина восстанавливает точную беседу; purge требует отдельного управляемого подтверждения", async () => {
  const document = createDocument()
  const host = document.createElement("div")
  document.append(host)
  const root = createRoot(host)
  const restored: string[] = []
  const purged: string[] = []
  const gate = Promise.withResolvers<void>()
  const props: ChatConversationList.Input = {
    items: [], trashOpen: true, deletedItems: [{id: "old", title: "Важная беседа"}],
    onSelect() {}, onCreate() {}, onRename() {}, onDelete() {}, onTrashToggle() {},
    onRestore(id) {restored.push(id)}, onPurge(id) {purged.push(id); return gate.promise},
  }
  const settle = async () => {for (let i = 0; i < 5; i++) {await Promise.resolve(); root.flush()}}
  const button = (label: string) => [...host.querySelectorAll("button")].find(button => button.textContent === label) as HTMLButtonElement
  try {
    root.render(List as unknown as CompiledTemplate<typeof props>, props)
    root.flush()
    button("Восстановить").click()
    await settle()
    expect(restored).toEqual(["old"])
    button("Удалить навсегда…").click()
    root.flush()
    expect(purged).toEqual([])
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain("Важная беседа")
    button("Отмена").click()
    root.flush()
    expect(host.querySelector('[role="alertdialog"]')).toBeNull()
    button("Удалить навсегда…").click()
    root.flush()
    const confirm = button("Да, удалить навсегда")
    confirm.click()
    confirm.click()
    expect(purged).toEqual(["old"])
    gate.resolve()
    await settle()
    expect(host.querySelector('[role="alertdialog"]')).toBeNull()
  } finally {gate.resolve(); root.unmount()}
})

test("незавершённый purge не предлагает восстановление; ошибка сохраняет подтверждение для повторной попытки", async () => {
  const document = createDocument()
  const host = document.createElement("div")
  document.append(host)
  const root = createRoot(host)
  const props: ChatConversationList.Input = {
    items: [], trashOpen: true, deletedItems: [{id: "partial", title: "Неполная", recoverable: false}],
    onSelect() {}, onCreate() {}, onRename() {}, onDelete() {}, onRestore() {throw new Error("Не вызывать")},
    onPurge() {throw new Error("Недоступен диск")},
  }
  const button = (label: string) => [...host.querySelectorAll("button")].find(button => button.textContent === label) as HTMLButtonElement
  try {
    root.render(List as unknown as CompiledTemplate<typeof props>, props)
    root.flush()
    expect(button("Восстановить").disabled).toBe(true)
    button("Удалить навсегда…").click()
    root.flush()
    button("Да, удалить навсегда").click()
    for (let i = 0; i < 5; i++) {await Promise.resolve(); root.flush()}
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull()
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Недоступен диск")
  } finally {root.unmount()}
})
