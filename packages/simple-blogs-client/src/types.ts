export type TocItem = {
  text: string
  slug: string
  level: 2 | 3
}

export type BlogAuthor = {
  slug?: string
  name: string
  bio?: string | null
}

export type BlogImage = {
  url: string
  width: number
  height: number
  alt: string
}

export type BlogFrontmatter = {
  title: string
  date: string
  updatedAt?: string
  description: string
  published: boolean
  tags?: string[]
  tagSlugs?: string[]
  category?: string
  categorySlug?: string
  image?: string
  imageAlt?: string
  /** Resolved `<title>` text, without the site suffix. */
  seoTitle: string
  ogTitle: string
  ogDescription: string
  ogImage?: BlogImage
  twitterCard: 'summary' | 'summary_large_image'
  twitterImage?: BlogImage
  canonicalUrl?: string
  noindex: boolean
  readTime?: number | null
  author?: BlogAuthor | string
  schemaType?: 'Article' | 'BlogPosting' | 'TechArticle' | 'HowTo' | 'Guide'
  clientOverview?: {
    project: string
    category: string
    services: string
    role: string
    verification?: string
  }
  product?: string
}

/** `TContent` is whatever the host's compile step produces (a React node, a serialized tree, ...). */
export type BlogPost<TContent = unknown> = {
  slug: string
  frontmatter: BlogFrontmatter
  content: TContent
  rawContent: string
  toc: TocItem[]
}

export type BlogPostSummary = Omit<BlogPost, 'content' | 'toc'>

export type BlogListOptions = {
  category?: string
  slugs?: string[]
  /** 'index' (default): index lifetime. 'postPage': post lifetime, no list tags. */
  cache?: 'index' | 'postPage'
}

export type BlogPostResolution<TContent = unknown> =
  | { kind: 'post'; post: BlogPost<TContent> }
  | { kind: 'redirect'; location: string; code: 301 | 302 }
  | { kind: 'not_found' }

export interface BlogProvider<TContent = unknown> {
  getBlogPosts(options?: BlogListOptions): Promise<BlogPostSummary[]>
  resolveBlogPath(slug: string): Promise<BlogPostResolution<TContent>>
}
