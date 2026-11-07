# simple-blogs-client

Framework-free client for the Simple Blogs API. It fetches posts, maps them to a typed shape, compiles MDX to a host-defined content value, and builds a table of contents. It has no dependency on Next.js or React.

## Install

```bash
pnpm add simple-blogs-client
```

## Usage

```ts
import { createBlogClient, compileToTree } from 'simple-blogs-client'

const blog = createBlogClient({
  baseUrl: 'https://api.example.com',
  siteSlug: 'my-site',
  siteKey: process.env.BLOG_SITE_KEY!,
  compile: async (rawMdx) => compileToTree(rawMdx),
  ttlSeconds: { index: 300, post: 600 },
})

const posts = await blog.getBlogPosts({ category: 'engineering' })
const result = await blog.resolveBlogPath('hello-world')
```

`createBlogClient` returns a `BlogProvider<TContent>`:

- `getBlogPosts(options?)`: list post summaries. Supports `category` and cursor paging. Pages are followed until the cursor repeats.
- `resolveBlogPath(slug)`: returns a post, a redirect, or not-found. Post fetches are tagged `blog:post:<slug>`.

## Configuration

| Option | Purpose |
| --- | --- |
| `baseUrl` | Absolute URL of the Simple Blogs API. Trailing slashes are removed. |
| `siteSlug` | Site identifier in the API path. |
| `siteKey` | Sent as the `Authorization` bearer token. Keep it on the server. |
| `compile` | Turns raw MDX into your content type. `compileToTree` gives a tree that any renderer can use. |
| `ttlSeconds` | Revalidation lifetimes in seconds for the index and for single posts. |
| `decorateRequest` | Optional. Adds host fetch options from a `CacheHint` (`{ revalidate, tags }`). The client never reads it. |
| `fetch` | Optional. Replaces the global `fetch`. |

### Next.js cache hints

Next.js reads cache hints from the `next` option on `fetch`. Pass `decorateRequest` to attach them:

```ts
decorateRequest: (init, cache) => ({
  ...init,
  next: { revalidate: cache.revalidate, tags: cache.tags },
})
```

## Other exports

- `compileToTree(mdx)`: MDX to a hast-based `BlogTree`, with syntax highlighting. Code blocks have trailing blank lines removed.
- `extractTableOfContents(rawMdx)`: `h2` and `h3` entries with slugs, read from the raw MDX.
- `mapApiSummary`, `mapApiDetail`, `apiPostSchema`, `apiEnvelopeSchema`: API mapping and Zod schemas. Types are inferred from the Zod schemas.
- Types: `BlogPostSummary`, `BlogPostDetail`, `BlogFrontmatter`, `BlogListOptions`, `BlogPostResolution`, `BlogProvider`, `TocItem`, `BlogTree`, `CacheHint`.

## Development

```bash
pnpm install
pnpm test
pnpm run build
```

`pnpm run build` writes ESM output and type declarations to `dist/`.
