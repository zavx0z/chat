import {expect, test} from "bun:test"
import {createRoot} from "@zavx0z/immersive/XReact"
import {createDocument, type HTMLButtonElement} from "@zavx0z/immersive"
import {createDocumentRenderer} from "@zavx0z/immersive/renderer/html"
import type {CompiledTemplate} from "@zavx0z/immersive/XReact/compiled"
import MessageBubble, {type MessageBubbleInput} from "../index"

test.each([true, false])("панель действий own=%s выровнена к своей стороне, копирование остаётся доступным", async own => {
  const document = createDocument()
  const host = document.createElement("div")
  host.setAttribute("style", "width:354px;height:300px")
  document.append(host)
  const root = createRoot(host)
  const renderer = createDocumentRenderer({document, root: host, viewport: {width: 354, height: 300},
    styleSheets: [await Bun.file(Bun.resolveSync("@zavx0z/immersive/ui/theme.css", import.meta.dir)).text()],
  })
  let finish!: () => void
  let calls = 0
  const pending = new Promise<void>(resolve => {finish = resolve})
  const props: MessageBubbleInput = {id: "message", own, label: "Сообщение", onCopy() {calls++; return pending}}
  const flush = () => {root.flush(); renderer.flush()}
  try {
    root.render(MessageBubble as unknown as CompiledTemplate<MessageBubbleInput>, props)
    flush()
    const row = host.querySelector("article")!
    const toolbar = host.querySelector("footer")!
    const button = toolbar.querySelector("button") as HTMLButtonElement
    const rowBox = row.getBoundingClientRect()
    const actionsBox = toolbar.getBoundingClientRect()
    expect(actionsBox.width).toBeGreaterThan(0)
    expect(actionsBox.width).toBeLessThan(rowBox.width)
    expect(Math.abs(own ? actionsBox.right - rowBox.right : actionsBox.left - rowBox.left)).toBeLessThanOrEqual(1)
    button.click()
    flush()
    expect(button.disabled).toBeFalse()
    expect(button.getAttribute("aria-label")).toBe("Копируется…")
    button.click()
    flush()
    expect(calls).toBe(1)
    finish()
    await pending
    await Bun.sleep(0)
    flush()
    expect(button.disabled).toBeFalse()
    expect(toolbar.textContent).toContain("Скопировано")
    const completedBox = toolbar.getBoundingClientRect()
    expect(Math.abs(own ? completedBox.right - rowBox.right : completedBox.left - rowBox.left)).toBeLessThanOrEqual(1)
  } finally {root.unmount(); renderer.dispose()}
})
