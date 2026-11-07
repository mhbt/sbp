import { describe, expect, it, vi } from 'vitest'
import { createBlogClient } from '../src/client'

const summary = {
  slug: 'hello',
  title: 'Hello',
  publishedAt: '2026-01-01T00:00:00.000Z',
  bodyMdx: '## One',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function baseConfig(fetchMock: unknown) {
  return {
    baseUrl: 'https://api.example.com/',
    siteSlug: 'my site',
    siteKey: 'key-123',
    ttlSeconds: { index: 60, post: 600 },
    compile: async (raw: string) => `compiled:${raw}`,
    fetch: fetchMock as typeof fetch,
  }
}

describe('createBlogClient', () => {
  it('rejects a base URL that is not absolute', () => {
    expect(() => createBlogClient({ ...baseConfig(undefined), baseUrl: 'not a url' }))
      .toThrow('baseUrl must be an absolute URL.')
  })

  it('sends the bearer key, encoded slug, and index cache hint for list requests', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: 'SUCCESS', posts: [summary], meta: { nextCursor: null } }))
    const decorateRequest = vi.fn((init: RequestInit, _cache: unknown) => init)
    const client = createBlogClient({ ...baseConfig(fetchMock), decorateRequest })

    const posts = await client.getBlogPosts()

    expect(posts.map((post) => post.slug)).toEqual(['hello'])
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.toString()).toBe('https://api.example.com/v1/sites/my%20site/posts?limit=100')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key-123')
    expect(decorateRequest.mock.calls[0][1]).toEqual({ revalidate: 60, tags: ['blog', 'blog:posts'] })
  })

  it('follows cursors and sorts posts newest first', async () => {
    const older = { ...summary, slug: 'older', publishedAt: '2025-01-01T00:00:00.000Z' }
    const pages = [
      jsonResponse({ status: 'SUCCESS', posts: [older], meta: { nextCursor: 'c2' } }),
      jsonResponse({ status: 'SUCCESS', posts: [summary], meta: { nextCursor: null } }),
    ]
    const fetchMock = vi.fn(async () => pages.shift() as Response)
    const client = createBlogClient(baseConfig(fetchMock))

    const posts = await client.getBlogPosts()

    expect(posts.map((post) => post.slug)).toEqual(['hello', 'older'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('resolves a post through the injected compile step and builds the TOC', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: 'SUCCESS', post: summary }))
    const client = createBlogClient(baseConfig(fetchMock))

    const result = await client.resolveBlogPath('hello')

    expect(result.kind).toBe('post')
    if (result.kind !== 'post') return
    expect(result.post.content).toBe('compiled:## One')
    expect(result.post.toc).toEqual([{ text: 'One', slug: 'one', level: 2 }])
  })

  it('maps a 404 to not_found', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: 'NOT_FOUND' }, 404))
    const client = createBlogClient(baseConfig(fetchMock))

    expect(await client.resolveBlogPath('missing')).toEqual({ kind: 'not_found' })
  })
})
