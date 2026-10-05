/** Ordinal/id anchor хранит только положение одной resident строки, без тела сообщения. */
export type HistoryAnchor = Readonly<{id: string, top: number}>

export function captureHistoryAnchor(viewport: HTMLElement, rows: readonly HTMLElement[]): HistoryAnchor | null {
  const box = viewport.getLayoutRect()
  if (box === null) return null
  const visible = rows.map(row => ({row, rect: row.getLayoutRect(viewport)}))
    .filter(item => item.rect !== null && item.rect.bottom > 0 && item.rect.top < box.height)
  const first = visible.find(item => item.rect!.top >= 0) ?? visible[0]
  const id = first?.row.getAttribute("data-chat-history-id")
  return first && id ? {id, top: first.rect!.top} : null
}

/** Реальные variable-height изменения компенсируются через существующий semantic scrollTop. */
export function restoreHistoryAnchor(viewport: HTMLElement, rows: readonly HTMLElement[], anchor: HistoryAnchor | null): void {
  if (anchor === null) return
  const row = rows.find(item => item.getAttribute("data-chat-history-id") === anchor.id)
  const rect = row?.getLayoutRect(viewport)
  if (rect) viewport.scrollTop += rect.top - anchor.top
}
