import { z } from 'zod'
import { apiPostSchema, mapApiDetail, mapApiSummary } from './mapper'
import type { BlogListOptions, BlogPostResolution, BlogProvider } from './types'

export const apiEnvelopeSchema = z.object({
  status: z.string().optional(),
  code: z.number().optional(),
  message: z.string().optional(),
  location: z.string().optional(),
  redirect: z.object({
    location: z.string().optional(),
    code: z.number().optional(),
  }).passthrough().optional(),
  posts: z.array(apiPostSchema).optional(),
  post: apiPostSchema.optional(),
  meta: z.object({ nextCursor: z.string().nullable().optional() }).passthrough().optional(),
}).passthrough()

type ApiEnvelope = z.infer<typeof apiEnvelopeSchema>

/** Cache hint for the host's fetch layer. The client never interprets it. */
export type CacheHint = {
  revalidate: number
  tags: string[]
}

export type BlogClientConfig<TContent> = {
  baseUrl: string
  siteSlug: string
  siteKey: string
  /** Turns post MDX into the host's content type. */
  compile: (rawMdx: string) => Promise<TContent>
  /** Lifetimes in seconds for list and post fetches. */
  ttlSeconds: { index: number; post: number }
  /** Lets a host add its own fetch options from a CacheHint (for example Next's `next`). */
  decorateRequest?: (init: RequestInit, cache: CacheHint) => RequestInit
  fetch?: typeof fetch
}

type ApiResult = {
  status: number
  location: string | null
  envelope?: ApiEnvelope
}

function apiError(response: Response, envelope?: ApiEnvelope): Error {
  const message = envelope?.message || response.statusText || 'Unknown API error'
  return new Error(`Simple Blogs API request failed (${response.status}): ${message}`)
}

function toApiResult({ response, envelope }: { response: Response; envelope?: ApiEnvelope }): ApiResult {
  const isRedirect = response.status === 301 || response.status === 302
  if (!response.ok && response.status !== 404 && !isRedirect) {
    throw apiError(response, envelope)
  }

  return {
    status: response.status,
    location: response.headers.get('location') ?? envelope?.location ?? envelope?.redirect?.location ?? null,
    envelope,
  }
}

function slugifyCategory(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function createBlogClient<TContent>(config: BlogClientConfig<TContent>): BlogProvider<TContent> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')
  try {
    new URL(baseUrl)
  } catch {
    throw new Error('baseUrl must be an absolute URL.')
  }

  const postsUrl = `${baseUrl}/v1/sites/${encodeURIComponent(config.siteSlug)}/posts`
  const doFetch: typeof fetch = config.fetch ?? ((input, init) => fetch(input, init))

  async function requestEnvelope(url: URL, cache: CacheHint) {
    const init: RequestInit = {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.siteKey}`,
      },
      redirect: 'manual',
    }
    const response = await doFetch(url, config.decorateRequest?.(init, cache) ?? init)
    const payload = await response.json().catch(() => undefined)
    const parsed = apiEnvelopeSchema.safeParse(payload)

    return { response, envelope: parsed.success ? parsed.data : undefined }
  }

  async function fetchPostsPage(category: string | null, cursor: string | null, cache: BlogListOptions['cache']): Promise<ApiResult> {
    const url = new URL(postsUrl)
    url.searchParams.set('limit', '100')
    if (category) url.searchParams.set('category', category)
    if (cursor) url.searchParams.set('cursor', cursor)

    const hint: CacheHint = cache === 'postPage'
      ? { revalidate: config.ttlSeconds.post, tags: [] }
      : { revalidate: config.ttlSeconds.index, tags: ['blog', 'blog:posts'] }
    return toApiResult(await requestEnvelope(url, hint))
  }

  async function fetchPost(slug: string): Promise<ApiResult> {
    const url = new URL(`${postsUrl}/${encodeURIComponent(slug)}`)
    return toApiResult(await requestEnvelope(url, {
      revalidate: config.ttlSeconds.post,
      tags: [`blog:post:${slug}`],
    }))
  }

  return {
    async getBlogPosts(options: BlogListOptions = {}) {
      const posts = []
      const seenCursors = new Set<string>()
      let cursor: string | null = null

      do {
        const category = options.category ? slugifyCategory(options.category) : null
        const { status, envelope } = await fetchPostsPage(category, cursor, options.cache)
        if (envelope?.status !== 'SUCCESS' || !Array.isArray(envelope.posts)) {
          throw new Error(`Simple Blogs API list request failed (${status}).`)
        }

        posts.push(...envelope.posts.map(mapApiSummary))
        cursor = envelope.meta?.nextCursor ?? null
        if (cursor && seenCursors.has(cursor)) {
          throw new Error('Simple Blogs API returned a repeated post cursor.')
        }
        if (cursor) seenCursors.add(cursor)
      } while (cursor)

      return posts.sort((left, right) =>
        (Date.parse(right.frontmatter.date) || 0) - (Date.parse(left.frontmatter.date) || 0),
      )
    },

    async resolveBlogPath(slug: string): Promise<BlogPostResolution<TContent>> {
      const { status, location, envelope } = await fetchPost(slug)

      if (status === 404 || envelope?.status === 'NOT_FOUND') {
        return { kind: 'not_found' }
      }

      if (status === 301 || status === 302 || envelope?.status === 'REDIRECT') {
        const code = status === 301 || status === 302
          ? status
          : envelope?.redirect?.code ?? envelope?.code

        if ((code !== 301 && code !== 302) || !location) {
          throw new Error('Simple Blogs API returned an invalid redirect response.')
        }

        return { kind: 'redirect', location, code }
      }

      if (envelope?.status !== 'SUCCESS' || !envelope.post) {
        throw new Error(`Simple Blogs API post request failed (${status}).`)
      }

      return { kind: 'post', post: await mapApiDetail(envelope.post, config.compile) }
    },
  }
}
