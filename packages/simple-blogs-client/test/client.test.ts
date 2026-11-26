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

  it('fetches llms.txt with bearer auth and blog:llms cache hint', async () => {
    const fetchMock = vi.fn(async () =>
      new Response('# My Site\n\n> Summary\n', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      }),
    )
    const decorateRequest = vi.fn((init: RequestInit, _cache: unknown) => init)
    const client = createBlogClient({ ...baseConfig(fetchMock), decorateRequest })

    const text = await client.getLlmsTxt()

    expect(text).toBe('# My Site\n\n> Summary\n')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.toString()).toBe('https://api.example.com/v1/sites/my%20site/llms.txt')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key-123')
    expect(decorateRequest.mock.calls[0][1]).toEqual({ revalidate: 60, tags: ['blog:llms'] })
  })

  it('throws on non-OK llms.txt response', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: 'Forbidden' }, 403))
    const client = createBlogClient(baseConfig(fetchMock))

    await expect(client.getLlmsTxt()).rejects.toThrow('Simple Blogs API request failed (403): Forbidden')
  })

  it('fetches post markdown with canonical link, ETag, cache hint, and 404 mapping', async () => {
    const md = '---\ntitle: Hello\nurl: https://example.com/blog/hello\n---\n\n# Hello\n'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(md, {
          status: 200,
          headers: {
            'content-type': 'text/markdown; charset=utf-8',
            etag: '"abc123"',
            link: '<https://example.com/blog/hello>; rel="canonical"',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ status: 'NOT_FOUND', message: 'Not found' }, 404))
    const decorateRequest = vi.fn((init: RequestInit, _cache: unknown) => init)
    const client = createBlogClient({ ...baseConfig(fetchMock), decorateRequest })

    const found = await client.getPostMarkdown('hello')
    expect(found).toEqual({
      kind: 'found',
      markdown: md,
      canonicalUrl: 'https://example.com/blog/hello',
      etag: '"abc123"',
    })
    const [url] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.toString()).toBe('https://api.example.com/v1/sites/my%20site/posts/hello/markdown')
    expect(decorateRequest.mock.calls[0][1]).toEqual({ revalidate: 600, tags: ['blog:post:hello'] })

    expect(await client.getPostMarkdown('draft-post')).toEqual({ kind: 'not_found' })
  })

  it('extracts canonicalUrl from frontmatter url when Link header is absent and throws on 500', async () => {
    const md = '---\ntitle: Hello\nurl: "https://example.com/blog/from-fm"\n---\n\n# Hello\n'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(md, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ message: 'Server error' }, 500))
    const client = createBlogClient(baseConfig(fetchMock))

    const found = await client.getPostMarkdown('hello')
    expect(found).toEqual({
      kind: 'found',
      markdown: md,
      canonicalUrl: 'https://example.com/blog/from-fm',
      etag: null,
    })

    await expect(client.getPostMarkdown('boom')).rejects.toThrow('Simple Blogs API request failed (500): Server error')
  })
})
