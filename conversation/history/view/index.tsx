/** Общий измеряемый viewport истории: bounded slots, scroll anchor и visibility lifecycle. */
import Button from "@zavx0z/immersive-ui-component-button-basic"
import {useLayoutEffect, useRef} from "@zavx0z/immersive-component"
import {observeElementLayout} from "@zavx0z/immersive-dom"
import {captureHistoryAnchor, type HistoryAnchor} from "./src/history-anchor"
import type {ChatHistoryView as Contract} from "./contract"
export type {ChatHistoryView} from "./contract"

export default function ChatHistoryView(props: Contract.Input) {
  const log = useRef<HTMLElement | null>(null)
  const end = useRef<HTMLElement | null>(null)
  const anchor = useRef<HistoryAnchor | null>(null)
  const heights = useRef(new Map<string, number>())
  const identity = props.identity
  const previous = useRef(identity)
  const measuring = useRef(false)
  const followingIntent = useRef(props.history.following)
  const acknowledgedFollowing = useRef(props.history.following)
  const userScrollEpoch = useRef(0)
  const measuredScrollEpoch = useRef(0)
  const writingScroll = useRef(false)
  const interactionPinned = useRef(false)
  const descendantWheel = useRef<{viewport: HTMLElement, before: number, ownedBefore: number | null} | null>(null)
  const ownedScrollTop = useRef<number | null>(null)
  const markUserScroll = (): void => {
    interactionPinned.current = false
    followingIntent.current = false
    userScrollEpoch.current++
    ownedScrollTop.current = null
  }
  const inputElement = (target: unknown): HTMLElement | null => {
    const node = target as HTMLElement | null
    return typeof node?.closest === "function" ? node : node?.parentElement ?? null
  }
  const ownInput = (target: unknown): boolean => inputElement(target)?.closest("[data-chat-messages]") === log.current
  const pinInteraction = (target: unknown): void => {
    const viewport = log.current
    const element = inputElement(target)
    if (!viewport || !element || !ownInput(target)) return
    const row = element.closest<HTMLElement>("[data-chat-history-id]")
    if (!row || row.closest("[data-chat-messages]") !== viewport) return
    const rect = row.getLayoutRect(viewport)
    if (!rect) return
    const id = row.getAttribute("data-chat-history-id")
    if (!id) return
    // Удерживаем именно выбранную строку, даже если она видима лишь частично.
    anchor.current = {id, top: rect.top}
    followingIntent.current = false
    interactionPinned.current = true
    ownedScrollTop.current = null
    measuredScrollEpoch.current = userScrollEpoch.current
    descendantWheel.current = null
  }
  const consumeDescendantWheel = (): void => {
    const pending = descendantWheel.current
    if (!pending) return
    descendantWheel.current = null
    const owned = ownedScrollTop.current
    const ownedChange = owned !== null && owned !== pending.ownedBefore && Math.abs(pending.viewport.scrollTop - owned) <= 0.5
    if (pending.viewport === log.current && !writingScroll.current && !ownedChange && pending.viewport.scrollTop !== pending.before) markUserScroll()
  }
  const observeDescendantWheel = (): void => {
    const viewport = log.current
    if (!viewport) return
    const pending = {viewport, before: viewport.scrollTop, ownedBefore: ownedScrollTop.current}
    descendantWheel.current = pending
    // Native wheel применяет default scroll после dispatch. Не предсказываем его owner.
    queueMicrotask(() => {if (descendantWheel.current === pending) consumeDescendantWheel()})
  }
  // Только input означает намерение пользователя. Layout clamp после unload тоже
  // выдаёт scroll, но не должен создавать epoch, ожидающий ещё одного кадра.
  const writeOwnedScroll = (viewport: HTMLElement, top: number): boolean => {
    if (Math.abs(viewport.scrollTop - top) <= 0.5 || ownedScrollTop.current !== null && Math.abs(ownedScrollTop.current - top) <= 0.5) return false
    writingScroll.current = true
    ownedScrollTop.current = top
    try {viewport.scrollTop = top} finally {writingScroll.current = false}
    return true
  }
  const ownRows = (viewport: HTMLElement) => [...viewport.querySelectorAll<HTMLElement>("[data-chat-history-id]")].filter(row => row.closest("[data-chat-messages]") === viewport)
  const measure = (freshLayout = false): void => {
    const viewport = log.current
    if (!viewport || measuring.current) return
    measuring.current = true
    try {
      const box = viewport.getLayoutRect()
      props.onVisible(box !== null && box.height > 0 && box.width > 0)
      if (!box || box.height <= 0 || props.history.rows.length === 0 && props.history.total > 0) {
        // Освобождённое окно больше не имеет прежнего scroll range. Не оставляем
        // requested offset от 96 строк на пустом/вновь загруженном окне из 32.
        // Смысловая позиция остаётся в anchor; controller сохраняет ordinal.
        measuredScrollEpoch.current = userScrollEpoch.current
        ownedScrollTop.current = null
        writeOwnedScroll(viewport, 0)
        return
      }
      if (previous.current !== identity) {
        previous.current = identity
        anchor.current = null
        interactionPinned.current = false
        descendantWheel.current = null
        userScrollEpoch.current = 0
        measuredScrollEpoch.current = 0
        ownedScrollTop.current = null
        followingIntent.current = props.history.following
        acknowledgedFollowing.current = props.history.following
      }
      if (acknowledgedFollowing.current !== props.history.following) {
        acknowledgedFollowing.current = props.history.following
        followingIntent.current = props.history.following
        if (props.history.following) interactionPinned.current = false
      }
      consumeDescendantWheel()
      const userPending = userScrollEpoch.current !== measuredScrollEpoch.current
      if (userPending && !freshLayout) return
      const rows = ownRows(viewport)
      if (interactionPinned.current && !rows.some(row => row.getAttribute("data-chat-history-id") === anchor.current?.id)) interactionPinned.current = false
      if (!userPending && !followingIntent.current && anchor.current) {
        const row = rows.find(item => item.getAttribute("data-chat-history-id") === anchor.current!.id)
        const rect = row?.getLayoutRect(viewport)
        if (rect && writeOwnedScroll(viewport, viewport.scrollTop + rect.top - anchor.current.top)) return
      }
      if (!userPending && followingIntent.current) {
        const endRect = end.current?.getLayoutRect(viewport)
        const delta = endRect === null || endRect === undefined ? 0 : endRect.bottom - box.height
        if (writeOwnedScroll(viewport, viewport.scrollTop + delta)) return
      }
      const positioned = rows.map(row => ({row, rect: row.getLayoutRect(viewport)}))
      const visible = positioned.filter(item => item.rect !== null && item.rect.bottom > 0 && item.rect.top < box.height)
      measuredScrollEpoch.current = userScrollEpoch.current
      if (!interactionPinned.current) anchor.current = captureHistoryAnchor(viewport, rows) ?? anchor.current
      const currentIds = new Set(props.history.rows.map(row => row.header.id))
      for (const id of heights.current.keys()) if (!currentIds.has(id)) heights.current.delete(id)
      for (const item of positioned) {
        const id = item.row.getAttribute("data-chat-history-id")!
        if (item.rect !== null) heights.current.set(id, item.rect.height)
      }
      props.onRowHeights?.(heights.current)
      const firstRect = positioned[0]?.rect
      const lastRect = positioned.at(-1)?.rect
      const atEnd = lastRect == null || lastRect.bottom <= box.height + 24
      followingIntent.current = !interactionPinned.current && atEnd && props.history.after === null
      props.onViewport({ids: visible.map(item => item.row.getAttribute("data-chat-history-id")!),
        nearStart: firstRect == null || firstRect.top >= -120,
        nearEnd: lastRect == null || lastRect.bottom <= box.height + 120,
        following: followingIntent.current})
    } finally {measuring.current = false}
  }
  useLayoutEffect(() => {
    const viewport = log.current
    if (!viewport) return
    const releases = [observeElementLayout(viewport, () => measure(true))]
    for (const row of ownRows(viewport)) {
      releases.push(observeElementLayout(row, () => measure(true), {relativeTo: viewport}))
    }
    queueMicrotask(() => measure())
    return () => {for (const release of releases) release()}
  }, [identity, props.history.rows, props.history.following])
  useLayoutEffect(() => () => props.onVisible(false), [identity])
  return <div
      role="log"
      aria-label="Сообщения"
      data-chat-messages=""
      ref={element => {log.current = element}}
      onWheel={event => {
        if (event.deltaY === 0) return
        if (ownInput(event.target)) markUserScroll()
        else observeDescendantWheel()
      }}
      onPointerDown={event => {
        if (!ownInput(event.target)) return
        pinInteraction(event.target)
        if (event.target === log.current) markUserScroll()
      }}
      onKeyDown={event => {
        if (!ownInput(event.target)) return
        if (["Enter", " ", "Spacebar"].includes(event.key) && inputElement(event.target)?.closest("button")) pinInteraction(event.target)
        else if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) markUserScroll()
      }}
      style={css`
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        min-height: 0;
        min-width: 0;
        width: 100%;
        gap: 20px;
        padding: 12px 4px;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: none;
      `}
    >
      <slot />
      {props.history.loading ? <HistoryLoading /> : null}
      {props.history.error ? <HistoryError error={props.history.error} onRetry={props.onRetry} /> : null}
      {props.history.unread > 0 ? <HistoryUnread
        count={props.history.unread}
        onTail={props.onTail}
      /> : null}
      <span
        ref={element => { end.current = element }}
        aria-hidden="true"
        style={css`
          display: block;
          flex-shrink: 0;
          width: 1px;
          height: 1px;
        `}
      />
    </div>
}

function HistoryLoading() {
  return <p role="status">Загрузка истории…</p>
}

function HistoryUnread(props: Readonly<{count: number, onTail(): void}>) {
  return <Button
    label={`Новые записи: ${props.count}`}
    onClick={() => props.onTail()}
  />
}

function HistoryError(props: Readonly<{error: string, onRetry?: (() => void) | undefined}>) {
  return <div role="alert">
    <p>{props.error}</p>
    {props.onRetry ? <Button label="Повторить загрузку" onClick={props.onRetry} /> : null}
  </div>
}
