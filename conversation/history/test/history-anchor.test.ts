import {expect, test} from "bun:test"
import {captureHistoryAnchor, restoreHistoryAnchor} from "../view/src/history-anchor"

function fixture() {
  const viewport = {scrollTop: 120, getLayoutRect: () => ({height: 300})} as unknown as HTMLElement
  const rows = [80, 30, 150].map((height, index) => ({id: `m${index}`, top: index === 0 ? -60 : index === 1 ? 20 : 50, height}))
  const nodes = rows.map(row => ({getAttribute: () => row.id, getLayoutRect: () => ({top: row.top, bottom: row.top + row.height, height: row.height})}) as unknown as HTMLElement)
  return {viewport, rows, nodes}
}

test("prepend/eviction и variable-height body сохраняют exact ordinal anchor без scrollHeight/clientHeight", () => {
  const f = fixture()
  const anchor = captureHistoryAnchor(f.viewport, f.nodes)
  expect(anchor).toEqual({id: "m1", top: 20})
  f.rows[1]!.top += 271.5
  restoreHistoryAnchor(f.viewport, f.nodes, anchor)
  expect(f.viewport.scrollTop).toBe(391.5)
  f.rows[1]!.top = -43.25
  restoreHistoryAnchor(f.viewport, f.nodes, anchor)
  expect(f.viewport.scrollTop).toBe(328.25)
  restoreHistoryAnchor(f.viewport, f.nodes.filter(node => node !== f.nodes[1]), anchor)
  expect(f.viewport.scrollTop).toBe(328.25)
})
