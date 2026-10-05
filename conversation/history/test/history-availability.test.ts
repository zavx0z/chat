import {expect, test} from 'bun:test'
import {createHistoryWindow} from '../index'

test('видимые тела читаются после страницы, даже если viewport пришёл до неё и геометрия не изменилась', async () => {
  let gate = Promise.withResolvers<void>()
  let reads = 0
  const history = createHistoryWindow({
    source: {
      async readPage(conversationId) {
        await gate.promise
        return {conversationId, revision: 1, total: 1, start: 0,
          items: [{id: 'entry', ordinal: 0, revision: 1, bodyBytes: 1, evidenceCount: 0}], before: null, after: null}
      },
      async readBody(conversationId, id) {reads++; return {conversationId, id, revision: 1, bytes: 1, entry: 'A', evidenceCount: 0}},
      async readEvidence() {throw new Error('Не используется в этом сценарии')},
    },
    isOrdinary: () => true,
    changed() {},
  })
  const viewport = {ids: ['entry'], following: true, nearStart: false, nearEnd: false}
  try {
    history.accept({id: 'conversation', history: {revision: 1, total: 1}})
    for (let cycle = 0; cycle < 2; cycle++) {
      history.viewport(viewport)
      gate.resolve()
      await Bun.sleep(0)
      history.viewport(viewport)
      await Bun.sleep(0)
      expect(history.getSnapshot().rows[0]!.body).toBe('A')
      expect(reads).toBe(cycle + 1)
      if (cycle === 0) {
        history.setActive(false)
        expect(history.getSnapshot().rows).toHaveLength(0)
        gate = Promise.withResolvers<void>()
        history.setActive(true)
      }
    }
  } finally {history.dispose()}
})
