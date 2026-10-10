/**
Измеряемая область истории с ограниченным содержимым и сохранением позиции.
Обычный ввод прокручивает платформа; компонент корректирует позицию только
при изменении раскладки или явном переходе к хвосту. Неизменные сообщения
не требуют DOM-изменений или дополнительных записей scrollTop после wheel.
*/
import {Button} from "@zavx0z/immersive/ui"
import {useLayoutEffect, useRef} from "@zavx0z/immersive/XReact"
import {observeElementLayout} from "@zavx0z/immersive"
import type {HistoryAnchor} from "./src/history-anchor"
import type {ChatHistoryView as Contract} from "./contract"
import type {HistoryViewport} from "../contract/viewport"
export type {ChatHistoryView} from "./contract"

export default function ChatHistoryView(props: Contract.Input) {
  const log = useRef<HTMLElement | null>(null)
  const content = useRef<HTMLElement | null>(null)
  const layout = useRef<{width: number, height: number, contentHeight: number, rows: readonly {id: string, top: number, width: number, height: number}[]} | null>(null)
  const anchor = useRef<HistoryAnchor | null>(null)
  const heights = useRef(new Map<string, number>())
  const identity = props.identity
  const previous = useRef(identity)
  const measuring = useRef(false)
  const scheduled = useRef<{freshLayout: boolean} | null>(null)
  const publishedViewport = useRef<HistoryViewport | null>(null)
  const currentMeasure = useRef<(freshLayout?: boolean) => void>(() => {})
  const scheduleMeasure = (freshLayout = false): void => {
    if (scheduled.current) {
      scheduled.current.freshLayout ||= freshLayout
      return
    }
    const pending = {freshLayout}
    scheduled.current = pending
    // Все observers одного прохода уже получили рамки. Объединяем их callbacks,
    // чтобы число чтений строк зависело от окна, а не от количества observers.
    queueMicrotask(() => {
      if (scheduled.current !== pending) return
      scheduled.current = null
      currentMeasure.current(pending.freshLayout)
    })
  }
  const followingIntent = useRef(props.history.following)
  const acknowledgedFollowing = useRef(props.history.following)
  const userScrollEpoch = useRef(0)
  const measuredScrollEpoch = useRef(0)
  const writingScroll = useRef(false)
  const interactionPinned = useRef(false)
  const pendingScrollInput = useRef<{viewport: HTMLElement, before: number, ownedBefore: number | null} | null>(null)
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
    pendingScrollInput.current = null
  }
  const consumeScrollInput = (): void => {
    const pending = pendingScrollInput.current
    if (!pending) return
    pendingScrollInput.current = null
    const owned = ownedScrollTop.current
    const ownedChange = owned !== null && owned !== pending.ownedBefore && Math.abs(pending.viewport.scrollTop - owned) <= 0.5
    if (pending.viewport === log.current && !writingScroll.current && !ownedChange && pending.viewport.scrollTop !== pending.before) markUserScroll()
  }
  const observeScrollInput = (): void => {
    const viewport = log.current
    if (!viewport || pendingScrollInput.current?.viewport === viewport) return
    const pending = {viewport, before: viewport.scrollTop, ownedBefore: ownedScrollTop.current}
    pendingScrollInput.current = pending
    // Native input применяет default scroll после dispatch. Не предсказываем его owner.
    queueMicrotask(() => {if (pendingScrollInput.current === pending) consumeScrollInput()})
  }
  // Только input означает намерение пользователя. Layout clamp после unload тоже
  // выдаёт scroll, но не должен создавать epoch, ожидающий ещё одного кадра.
  const writeOwnedScroll = (viewport: HTMLElement, top: number): boolean => {
    // scrollTop нормализует отрицательное смещение в ноль. Если короткая
    // страница уже помещается, измерение продолжается без ожидания callback.
    top = Math.max(0, top)
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
        // После освобождения controller очищает visibility. Новое окно получает
        // видимый диапазон повторно, даже если его ids совпадают с прежними.
        publishedViewport.current = null
        layout.current = null
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
        layout.current = null
        publishedViewport.current = null
        interactionPinned.current = false
        pendingScrollInput.current = null
        userScrollEpoch.current = 0
        measuredScrollEpoch.current = 0
        ownedScrollTop.current = null
        followingIntent.current = props.history.following
        acknowledgedFollowing.current = props.history.following
      }
      const requestedFollowing = acknowledgedFollowing.current !== props.history.following && props.history.following
      if (acknowledgedFollowing.current !== props.history.following) {
        acknowledgedFollowing.current = props.history.following
        followingIntent.current = props.history.following
        if (props.history.following) interactionPinned.current = false
      }
      consumeScrollInput()
      const userPending = userScrollEpoch.current !== measuredScrollEpoch.current
      if (userPending && !freshLayout) return
      const rows = ownRows(viewport)
      const positioned = rows.map(row => ({id: row.getAttribute("data-chat-history-id")!, rect: row.getLayoutRect(viewport)}))
      const contentRect = content.current?.getLayoutRect(viewport)
      if (!contentRect || positioned.some(item => item.rect === null)) return
      // Высота содержимого включает собственные отступы. Его положение даёт
      // фактический scroll после layout clamp, а не прежнее requested значение.
      const maximum = Math.max(0, contentRect.height - box.height)
      const effectiveTop = Math.max(0, -contentRect.top)
      const geometry = {width: box.width, height: box.height, contentHeight: contentRect.height,
        rows: positioned.map(item => ({id: item.id, top: item.rect!.top - contentRect.top, width: item.rect!.width, height: item.rect!.height}))}
      const prior = layout.current
      const differs = (a: number, b: number) => Math.abs(a - b) > 0.0001
      const changedLayout = prior === null || differs(prior.width, geometry.width) || differs(prior.height, geometry.height) ||
        differs(prior.contentHeight, geometry.contentHeight) || prior.rows.length !== geometry.rows.length ||
        geometry.rows.some((row, index) => {
          const old = prior.rows[index]
          return !old || old.id !== row.id || differs(old.top, row.top) || differs(old.width, row.width) || differs(old.height, row.height)
        })
      if (changedLayout) layout.current = geometry
      if (interactionPinned.current && !positioned.some(item => item.id === anchor.current?.id)) interactionPinned.current = false
      // Изменение видимости от wheel не является изменением содержимого.
      // На обычной прокрутке компонент вообще не пишет scrollTop.
      if (!userPending && (changedLayout || requestedFollowing)) {
        if (followingIntent.current) {
          if (writeOwnedScroll(viewport, maximum)) return
        } else if (anchor.current) {
          const rect = positioned.find(item => item.id === anchor.current!.id)?.rect
          const target = rect ? effectiveTop + rect.top - anchor.current.top : effectiveTop
          if (writeOwnedScroll(viewport, Math.min(maximum, Math.max(0, target)))) return
        }
      }
      const visible = positioned.filter(item => item.rect !== null && item.rect.bottom > 0 && item.rect.top < box.height)
      measuredScrollEpoch.current = userScrollEpoch.current
      const firstVisible = visible.find(item => item.rect!.top >= 0) ?? visible[0]
      if (!interactionPinned.current && firstVisible) anchor.current = {id: firstVisible.id, top: firstVisible.rect!.top}
      let heightsChanged = false
      const currentIds = new Set(props.history.rows.map(row => row.header.id))
      for (const id of heights.current.keys()) if (!currentIds.has(id)) {
        heights.current.delete(id)
        heightsChanged = true
      }
      for (const item of positioned) {
        if (item.rect !== null && heights.current.get(item.id) !== item.rect.height) {
          heights.current.set(item.id, item.rect.height)
          heightsChanged = true
        }
      }
      if (heightsChanged) props.onRowHeights?.(new Map(heights.current))
      const firstRect = positioned[0]?.rect
      const lastRect = positioned.at(-1)?.rect
      const atEnd = maximum - effectiveTop <= 0.5
      followingIntent.current = !interactionPinned.current && atEnd && props.history.after === null
      const nextViewport: HistoryViewport = {
        ids: visible.map(item => item.id),
        nearStart: firstRect == null || firstRect.top >= -120,
        nearEnd: lastRect == null || lastRect.bottom <= box.height + 120,
        following: followingIntent.current,
      }
      const published = publishedViewport.current
      if (!published || published.nearStart !== nextViewport.nearStart || published.nearEnd !== nextViewport.nearEnd ||
        published.following !== nextViewport.following || published.ids.length !== nextViewport.ids.length ||
        published.ids.some((id, index) => id !== nextViewport.ids[index])) {
        publishedViewport.current = nextViewport
        props.onViewport(nextViewport)
      }
    } finally {measuring.current = false}
  }
  currentMeasure.current = measure
  useLayoutEffect(() => {
    const viewport = log.current
    if (!viewport) return
    const releases = [observeElementLayout(viewport, () => scheduleMeasure(true))]
    for (const row of ownRows(viewport)) {
      releases.push(observeElementLayout(row, () => scheduleMeasure(true), {relativeTo: viewport}))
    }
    if (content.current) releases.push(observeElementLayout(content.current, () => scheduleMeasure(true), {relativeTo: viewport}))
    scheduleMeasure()
    return () => {
      scheduled.current = null
      for (const release of releases) release()
    }
  }, [identity, props.history.rows, props.history.following])
  useLayoutEffect(() => () => props.onVisible(false), [identity])
  return <div
      role="log"
      aria-label="Сообщения"
      data-chat-messages=""
      ref={element => {log.current = element}}
      onWheel={event => {
        if (event.deltaY === 0) return
        // Определяем сдвинутый viewport после native default action. Последний
        // wheel инерции у границы может не сдвинуть ни одного scroll owner.
        observeScrollInput()
      }}
      onPointerDown={event => {
        if (!ownInput(event.target)) return
        pinInteraction(event.target)
        if (event.target === log.current) markUserScroll()
      }}
      onKeyDown={event => {
        if (!ownInput(event.target)) return
        if (["Enter", " ", "Spacebar"].includes(event.key) && inputElement(event.target)?.closest("button")) pinInteraction(event.target)
        else if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) observeScrollInput()
      }}
      style={css`
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        min-height: 0;
        min-width: 0;
        width: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: none;
      `}
    >
      <div
        ref={element => {content.current = element}}
        style={css`
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          width: 100%;
          min-width: 0;
          gap: 20px;
          padding: 12px 4px;
        `}
      >
        <slot />
        {props.history.loading ? <HistoryLoading /> : null}
        {props.history.error ? <HistoryError error={props.history.error} onRetry={props.onRetry} /> : null}
        {props.history.unread > 0 ? <HistoryUnread
          count={props.history.unread}
          onTail={props.onTail}
        /> : null}
      </div>
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
