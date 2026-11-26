import type { BlogProvider } from 'simple-blogs-client'

type LlmsClient = Pick<BlogProvider, 'getLlmsTxt'>
type MarkdownClient = Pick<BlogProvider, 'getPostMarkdown'>

export type LlmsTxtSource = LlmsClient | (() => LlmsClient)
export type PostMarkdownSource = MarkdownClient | (() => MarkdownClient)

export type PostMarkdownHandlerOptions = {
  resolveCanonicalUrl?: (slug: string, apiCanonicalUrl: string | null) => string | null
}

/** App Router GET handler for `/llms.txt`. Passes through `text/plain; charset=utf-8` from the platform. */
export function llmsTxtHandler(source: LlmsTxtSource): () => Promise<Response> {
  return async () => {
    try {
      const client = typeof source === 'function' ? source() : source
      const body = await client.getLlmsTxt()
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    } catch (error) {
      console.error('Failed to load llms.txt from Simple Blogs API', error)
      return new Response('Service unavailable', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  }
}

/**
 * App Router GET handler for per-post markdown (`/blog/<slug>.md` via internal rewrite).
 * Sets `X-Robots-Tag: noindex` and `Link: <canonical>; rel="canonical"` so `.md` mirrors stay out of search.
 */
export function postMarkdownHandler(
  source: PostMarkdownSource,
  options?: PostMarkdownHandlerOptions,
) {
  return async (
    _request: Request,
    context: { params: Promise<{ slug: string }> | { slug: string } },
  ): Promise<Response> => {
    const { slug } = await context.params
    const normalizedSlug = slug.endsWith('.md') ? slug.slice(0, -3) : slug
    if (!normalizedSlug) {
      return new Response('Not found', { status: 404 })
    }

    try {
      const client = typeof source === 'function' ? source() : source
      const result = await client.getPostMarkdown(normalizedSlug)
      if (result.kind === 'not_found') {
        return new Response('Not found', { status: 404 })
      }

      const headers: Record<string, string> = {
        'Content-Type': 'text/markdown; charset=utf-8',
        'X-Robots-Tag': 'noindex',
      }
      const canonicalUrl = options?.resolveCanonicalUrl
        ? options.resolveCanonicalUrl(normalizedSlug, result.canonicalUrl)
        : result.canonicalUrl
      if (canonicalUrl) {
        headers.Link = `<${canonicalUrl}>; rel="canonical"`
      }
      if (result.etag) {
        headers.ETag = result.etag
      }
      return new Response(result.markdown, { status: 200, headers })
    } catch (error) {
      console.error('Failed to load post markdown from Simple Blogs API', normalizedSlug, error)
      return new Response('Service unavailable', { status: 503 })
    }
  }
}

/** Returns Next.js `metadata.alternates.types` entry advertising the markdown version of a post. */
export function markdownAlternate(slug: string): { 'text/markdown': string } {
  return {
    'text/markdown': `/blog/${encodeURIComponent(slug)}.md`,
  }
}
