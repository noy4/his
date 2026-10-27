/// <reference types="node" />
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch } from '@preact/signals-react'
import type { HisApi, HistoryVisit, SearchParams, SearchVisitsPage } from '@/app/api'
import { UrlsModel } from '../urls/urls.model.ts'
import { VisitsModel } from './visits.model.ts'

function visit(id: number, visitTime = id): HistoryVisit {
  return { id, urlId: 1, url: 'https://example.com', title: 'Example', visitTime, transition: 'link', visitCount: 3 }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('VisitsModel', () => {
  it('keeps repeated URL visits across pages and their cumulative count', async () => {
    const calls: SearchParams[] = []
    const model = new VisitsModel({
      history: {
        async searchVisits(params) {
          calls.push(params)
          return params.cursor
            ? { items: [visit(2), visit(1)], nextCursor: null }
            : { items: [visit(3)], nextCursor: 'next' }
        },
      },
    })

    await model.reload()
    await model.loadMore()
    await model.loadMore()
    assert.deepEqual(model.items.value.map((item) => item.id), [3, 2, 1])
    assert.deepEqual(model.items.value.map((item) => item.visitCount), [3, 3, 3])
    assert.equal(calls.length, 2)
    assert.equal(calls[1]?.cursor, 'next')
    assert.equal(calls[0]?.limit, 60)
    assert.equal(model.done.value, true)
    assert.equal(model.loading.value, false)
  })

  it('does not start another page request while one is pending', async () => {
    const response = deferred<SearchVisitsPage>()
    let calls = 0
    const model = new VisitsModel({
      history: {
        searchVisits() {
          calls += 1
          return response.promise
        },
      },
    })
    const pending = model.reload()
    await model.loadMore()
    assert.equal(calls, 1)
    response.resolve({ items: [visit(1)], nextCursor: null })
    await pending
    assert.equal(model.items.value.length, 1)
  })

  it('filters by query and visit range and ignores stale responses after a change', async () => {
    const initial = deferred<SearchVisitsPage>()
    const current = deferred<SearchVisitsPage>()
    const calls: SearchParams[] = []
    const model = new VisitsModel({
      history: {
        searchVisits(params) {
          calls.push(params)
          return calls.length === 1 ? initial.promise : current.promise
        },
      },
    })
    const state = model.filters
    const unsubscribe = model.subscribe()
    try {
      batch(() => {
        state.query.value = 'Example'
        state.from.value = 10
        state.to.value = 20
      })
      assert.equal(calls.length, 2)
      assert.deepEqual(calls[1], { query: 'Example', from: 10, to: 20, cursor: undefined, limit: 60 })
      initial.resolve({ items: [visit(100)], nextCursor: 'old' })
      await initial.promise
      assert.equal(model.items.value.length, 0)
      assert.equal(model.loading.value, true)
      current.resolve({ items: [visit(2, 15)], nextCursor: null })
      await current.promise
      assert.deepEqual(model.items.value.map((item) => item.id), [2])
      assert.equal(model.done.value, true)
    } finally {
      unsubscribe()
    }
  })

  it('retains loaded visits on resubscription but reloads when filters changed while unsubscribed', async () => {
    let calls = 0
    const model = new VisitsModel({
      history: {
        async searchVisits() {
          calls += 1
          return { items: [visit(calls)], nextCursor: null }
        },
      },
    })
    const state = model.filters
    let unsubscribe = model.subscribe()
    await Promise.resolve()
    unsubscribe()
    unsubscribe = model.subscribe()
    assert.equal(calls, 1)
    unsubscribe()
    state.query.value = 'new'
    unsubscribe = model.subscribe()
    try {
      await Promise.resolve()
      assert.equal(calls, 2)
      assert.deepEqual(model.items.value.map((item) => item.id), [2])
    } finally {
      unsubscribe()
    }
  })

  it('clears loading after a failed request and allows retry', async () => {
    let calls = 0
    const model = new VisitsModel({
      history: {
        async searchVisits() {
          if (++calls === 1) throw new Error('offline')
          return { items: [], nextCursor: null }
        },
      },
    })
    await assert.rejects(model.reload(), /offline/)
    assert.equal(model.loading.value, false)
    await model.loadMore()
    assert.equal(model.done.value, true)
  })

  it('reobserves a visible sentinel after each page and stops at the final page', async () => {
    const original = globalThis.IntersectionObserver
    const observers: FakeObserver[] = []
    class FakeObserver {
      disconnected = false
      callback: IntersectionObserverCallback
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
        observers.push(this)
      }
      observe() {}
      disconnect() { this.disconnected = true }
      intersect() {
        this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
      }
    }
    globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver
    const pages = [
      { items: [visit(3)], nextCursor: 'second' },
      { items: [visit(2)], nextCursor: 'third' },
      { items: [visit(1)], nextCursor: null },
    ]
    let failNext = false
    const model = new VisitsModel({
      history: {
        async searchVisits() {
          if (failNext) {
            failNext = false
            throw new Error('offline')
          }
          return pages.shift()!
        },
      },
    })
    model.setSentinel({} as Element)
    const unsubscribe = model.subscribe()
    try {
      await Promise.resolve()
      assert.equal(observers.length, 1)
      failNext = true
      await assert.rejects(model.loadMore(), /offline/)
      assert.equal(observers.length, 1)
      assert.equal(observers[0]!.disconnected, false)
      observers[0]!.intersect()
      await Promise.resolve()
      assert.equal(observers[0]!.disconnected, true)
      assert.equal(observers.length, 2)
      observers[1]!.intersect()
      await Promise.resolve()
      assert.equal(model.done.value, true)
      assert.equal(observers[1]!.disconnected, true)
      assert.equal(observers.length, 2)
      assert.deepEqual(model.items.value.map((item) => item.id), [3, 2, 1])
    } finally {
      unsubscribe()
      if (original) globalThis.IntersectionObserver = original
      else Reflect.deleteProperty(globalThis, 'IntersectionObserver')
    }
  })

  it('owns filters independently from Urls and resets them for a new view instance', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const api = {
      history: {
        async search() { return { items: [], nextCursor: null } },
        async searchVisits() { return { items: [], nextCursor: null } },
      },
    } as unknown as HisApi
    const urls = new UrlsModel(api)
    const visits = new VisitsModel(api)
    assert.notEqual(urls.filters, visits.filters)

    urls.filters.setInput(' Urls ')
    urls.filters.setRange(100, 200)
    t.mock.timers.tick(300)
    assert.equal(urls.filters.query.value, 'Urls')
    assert.equal(visits.filters.query.value, '')
    assert.equal(visits.filters.from.value, null)

    visits.filters.setInput(' Visits ')
    visits.filters.setRange(10, 20)
    t.mock.timers.tick(300)
    assert.equal(visits.filters.query.value, 'Visits')
    assert.equal(urls.filters.query.value, 'Urls')
    assert.equal(urls.filters.from.value, 100)
    assert.equal(urls.filters.to.value, 200)

    const nextVisits = new VisitsModel(api)
    assert.equal(nextVisits.filters.input.value, '')
    assert.equal(nextVisits.filters.query.value, '')
    assert.equal(nextVisits.filters.from.value, null)
    assert.equal(nextVisits.filters.to.value, null)
    assert.equal(nextVisits.items.value.length, 0)
    assert.equal(nextVisits.cursor.value, null)
  })
})
