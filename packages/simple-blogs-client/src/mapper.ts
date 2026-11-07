import { z } from 'zod'
import { extractTableOfContents } from './toc'
import type { BlogAuthor, BlogFrontmatter, BlogImage, BlogPost, BlogPostSummary } from './types'

const apiTaxonomySchema = z.object({
  name: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
}).passthrough()

const apiImageSchema = z.object({
  url: z.string().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  alt: z.string().nullable().optional(),
}).passthrough().nullable().optional()

const apiAuthorSchema = z.union([
  z.object({
    name: z.string(),
    slug: z.string().optional(),
    bio: z.string().nullable().optional(),
  }).passthrough(),
  z.string(),
]).nullable().optional()

export const apiPostSchema = z.object({
  slug: z.string(),
  title: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  readTime: z.number().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  contentUpdatedAt: z.string().nullable().optional(),
  author: apiAuthorSchema,
  category: apiTaxonomySchema.nullable().optional(),
  tags: z.array(apiTaxonomySchema).nullable().optional(),
  featuredImage: apiImageSchema,
  bodyMdx: z.string().nullable().optional(),
  canonicalUrl: z.string().nullable().optional(),
  seo: z.unknown().optional(),
  og: z.unknown().optional(),
  twitter: z.unknown().optional(),
  meta: z.unknown().optional(),
}).passthrough()

export type ApiPost = z.infer<typeof apiPostSchema>

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string')
}

function mapAuthor(value: unknown): BlogAuthor | string | undefined {
  if (typeof value === 'string') return value

  const author = asRecord(value)
  const name = asString(author.name)
  if (!name) return undefined

  return {
    name,
    slug: asString(author.slug),
    bio: typeof author.bio === 'string' || author.bio === null ? author.bio : undefined,
  }
}

function mapImage(value: unknown): BlogImage | undefined {
  const image = asRecord(value)
  const url = asString(image.url)
  const { width, height, alt } = image
  if (!url || typeof width !== 'number' || typeof height !== 'number' || typeof alt !== 'string') {
    return undefined
  }

  return { url, width, height, alt }
}

function mapCanonicalUrl(value: unknown): string | undefined {
  const raw = asString(value)
  if (!raw) return undefined

  try {
    const url = new URL(raw)
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return undefined
  }
}

function mapFrontmatter(post: ApiPost): BlogFrontmatter {
  const meta = asRecord(post.meta)
  const metaFrontmatter = asRecord(meta.frontmatter)
  const seo = asRecord(post.seo)
  const openGraph = asRecord(post.og)
  const twitter = asRecord(post.twitter)
  const featuredImage = asRecord(post.featuredImage)
  const title = asString(post.title) ?? asString(metaFrontmatter.title) ?? ''
  const excerpt = asString(post.excerpt) ?? asString(metaFrontmatter.description) ?? ''
  const seoTitle = asString(seo.title) ?? title
  const category = asRecord(post.category)
  const author = mapAuthor(post.author) ?? mapAuthor(metaFrontmatter.author ?? meta.author)
  const apiTags = Array.isArray(post.tags) ? post.tags : undefined
  const tags = apiTags
    ? apiTags.map((tag) => asString(asRecord(tag).name)).filter((tag): tag is string => Boolean(tag))
    : asStringList(metaFrontmatter.tags) ?? []
  const tagSlugs = apiTags
    ? apiTags.map((tag) => asString(asRecord(tag).slug)).filter((slug): slug is string => Boolean(slug))
    : asStringList(metaFrontmatter.tagSlugs)
  const metadataReadTime = metaFrontmatter.readTime ?? meta.readTime
  const readTime = typeof post.readTime === 'number' && Number.isFinite(post.readTime)
    ? post.readTime
    : typeof metadataReadTime === 'number' && Number.isFinite(metadataReadTime)
      ? metadataReadTime
      : null
  const clientOverview = asRecord(metaFrontmatter.clientOverview ?? meta.clientOverview)
  const mappedClientOverview = Object.keys(clientOverview).length > 0
    ? clientOverview as BlogFrontmatter['clientOverview']
    : undefined

  const twitterImage = mapImage(twitter.image)

  return {
    title,
    description: asString(seo.description) ?? excerpt,
    date: asString(post.publishedAt) ?? asString(metaFrontmatter.date) ?? '',
    updatedAt: asString(post.contentUpdatedAt) ?? asString(metaFrontmatter.updatedAt),
    published: true,
    tags,
    tagSlugs,
    category: asString(category.name) ?? asString(metaFrontmatter.category),
    categorySlug: asString(category.slug) ?? asString(metaFrontmatter.categorySlug),
    image: asString(featuredImage.url) ?? asString(metaFrontmatter.image),
    imageAlt: asString(featuredImage.alt) ?? asString(metaFrontmatter.imageAlt),
    seoTitle,
    ogTitle: asString(openGraph.title) ?? title,
    ogDescription: asString(openGraph.description) ?? excerpt,
    ogImage: mapImage(openGraph.image),
    twitterCard: twitter.card === 'summary_large_image' || (twitter.card === undefined && twitterImage)
      ? 'summary_large_image'
      : 'summary',
    twitterImage,
    canonicalUrl: mapCanonicalUrl(post.canonicalUrl),
    noindex: seo.noindex === true,
    readTime,
    author,
    schemaType: asString(metaFrontmatter.schemaType ?? meta.schemaType) as BlogFrontmatter['schemaType'],
    clientOverview: mappedClientOverview,
    product: asString(metaFrontmatter.product) ?? asString(meta.product),
  }
}

export function mapApiSummary(post: ApiPost): BlogPostSummary {
  return {
    slug: post.slug,
    frontmatter: mapFrontmatter(post),
    rawContent: '',
  }
}

export async function mapApiDetail<TContent>(
  post: ApiPost,
  compile: (rawMdx: string) => Promise<TContent>,
): Promise<BlogPost<TContent>> {
  const rawContent = typeof post.bodyMdx === 'string' ? post.bodyMdx : ''
  const content = await compile(rawContent)

  return {
    ...mapApiSummary(post),
    content,
    rawContent,
    toc: extractTableOfContents(rawContent),
  }
}
