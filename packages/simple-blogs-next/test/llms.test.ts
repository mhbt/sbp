import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { markdownAlternate, postMarkdownHandler } from '../src/llms.ts'

describe('postMarkdownHandler', () => {
  it('returns 200 markdown with X-Robots-Tag, canonical Link, and ETag', async () => {
    const handler = postMarkdownHandler(
      {
        getPostMarkdown: async (slug) => ({
          kind: 'found',
          markdown: `# ${slug}\n`,
          canonicalUrl: `https://example.com/blog/${slug}`,
          etag: '"etag-1"',
        }),
      },
    )

    const res = await handler(new Request('https://example.com/blog/hello.md'), {
      params: Promise.resolve({ slug: 'hello.md' }),
    })

    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8')
    assert.equal(res.headers.get('x-robots-tag'), 'noindex')
    assert.equal(res.headers.get('link'), '<https://example.com/blog/hello>; rel="canonical"')
    assert.equal(res.headers.get('etag'), '"etag-1"')
    assert.equal(await res.text(), '# hello\n')
  })

  it('returns 301 and 302 redirects to /blog/<new-slug>.md with X-Robots-Tag: noindex', async () => {
    const results = new Map([
      ['old-hello', { kind: 'redirect' as const, status: 301 as const, slug: 'new-hello' }],
      ['temp-hello', { kind: 'redirect' as const, status: 302 as const, slug: 'with space' }],
    ])
    const handler = postMarkdownHandler({
      getPostMarkdown: async (slug) => results.get(slug) ?? { kind: 'not_found' },
    })

    const res301 = await handler(new Request('https://example.com/blog/old-hello.md'), {
      params: Promise.resolve({ slug: 'old-hello.md' }),
    })
    assert.equal(res301.status, 301)
    assert.equal(res301.headers.get('location'), '/blog/new-hello.md')
    assert.equal(res301.headers.get('x-robots-tag'), 'noindex')
    assert.equal(await res301.text(), '')

    const res302 = await handler(new Request('https://example.com/blog/temp-hello.md'), {
      params: Promise.resolve({ slug: 'temp-hello.md' }),
    })
    assert.equal(res302.status, 302)
    assert.equal(res302.headers.get('location'), '/blog/with%20space.md')
    assert.equal(res302.headers.get('x-robots-tag'), 'noindex')
  })

  it('returns 404 on not_found and 503 when client throws', async () => {
    const handler = postMarkdownHandler({
      getPostMarkdown: async (slug) => {
        if (slug === 'boom') throw new Error('upstream down')
        return { kind: 'not_found' }
      },
    })

    const notFound = await handler(new Request('https://example.com/blog/missing.md'), {
      params: Promise.resolve({ slug: 'missing.md' }),
    })
    assert.equal(notFound.status, 404)

    const origErr = console.error
    console.error = () => {}
    try {
      const errorRes = await handler(new Request('https://example.com/blog/boom.md'), {
        params: Promise.resolve({ slug: 'boom.md' }),
      })
      assert.equal(errorRes.status, 503)
    } finally {
      console.error = origErr
    }
  })

  it('builds text/markdown alternate link with encoded slug', () => {
    assert.deepEqual(markdownAlternate('hello world'), {
      'text/markdown': '/blog/hello%20world.md',
    })
  })
})
