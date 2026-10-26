import { describe, expect, test, vi } from 'vitest'
import { createIndexer, shouldAutoWarm } from './smartIndex'

const docs = keys => keys.map(key => ({ key, text: key }))
const tick = () => new Promise(r => setTimeout(r, 0))

describe('createIndexer', () => {
  test('builds once even when the background start and the chat both ask', async () => {
    const build = vi.fn(async () => ({ a: [1] }))
    const ix = createIndexer(build)
    const p1 = ix.ensure(docs(['a'])), p2 = ix.ensure(docs(['a']))
    await Promise.all([p1, p2])
    expect(build).toHaveBeenCalledTimes(1)
    expect(ix.get().vecs).toEqual({ a: [1] })
  })

  test('tells listeners loading -> ready', async () => {
    const ix = createIndexer(async (_d, on) => { on('download', 50); return {} })
    const seen = []
    ix.subscribe(s => seen.push(s.step ? `${s.state}:${s.step}` : s.state))
    await ix.ensure(docs(['a']))
    expect(seen).toEqual(['loading', 'loading:download', 'ready'])
  })

  test('rebuilds when the journal changes (the builder itself only re-reads new dishes)', async () => {
    const build = vi.fn(async d => Object.fromEntries(d.map(x => [x.key, [1]])))
    const ix = createIndexer(build)
    await ix.ensure(docs(['a']))
    await ix.ensure(docs(['a']))
    await ix.ensure(docs(['a', 'b']))
    expect(build).toHaveBeenCalledTimes(2)
    expect(Object.keys(ix.get().vecs)).toEqual(['a', 'b'])
  })

  test('keeps the old vectors usable while a rebuild runs', async () => {
    let finish
    const ix = createIndexer(async d => (d.length === 1 ? { a: [1] } : new Promise(r => { finish = () => r({ a: [1], b: [2] }) })))
    await ix.ensure(docs(['a']))
    ix.ensure(docs(['a', 'b']))
    await tick()
    expect(ix.get().state).toBe('loading')
    expect(ix.get().vecs).toEqual({ a: [1] })
    finish(); await tick()
    expect(ix.get().state).toBe('ready')
  })

  test('says "off" when the model cannot load, without throwing at the caller', async () => {
    const ix = createIndexer(async () => { throw new Error('offline') })
    await expect(ix.ensure(docs(['a']))).resolves.toBe(null)
    expect(ix.get().state).toBe('off')
  })
})

describe('shouldAutoWarm', () => {
  test('downloads in the background normally', () => {
    expect(shouldAutoWarm({ connection: { effectiveType: '4g', saveData: false } })).toBe(true)
    expect(shouldAutoWarm({})).toBe(true)
  })

  test('waits for the chat when Data Saver is on or the connection is very slow', () => {
    expect(shouldAutoWarm({ connection: { saveData: true } })).toBe(false)
    expect(shouldAutoWarm({ connection: { effectiveType: '2g' } })).toBe(false)
    expect(shouldAutoWarm({ connection: { effectiveType: 'slow-2g' } })).toBe(false)
  })
})
