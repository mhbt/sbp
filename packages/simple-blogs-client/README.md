# simple-blogs-client

Framework-free client for the Simple Blogs API. It fetches posts, maps them to a typed shape, compiles MDX to a host-defined content value, and builds a table of contents. It has no dependency on Next.js or React.

## Install

Not published to npm. Pin the tarball from [GitHub Releases](https://github.com/mhbt/sbp/releases) in `package.json`:

```json
{
  "dependencies": {
    "simple-blogs-client": "https://github.com/mhbt/sbp/releases/download/v0.1.0/simple-blogs-client-0.1.0.tgz"
  }
}
```

Then run `pnpm install`. The complete setup guide is in the [sbp README](https://github.com/mhbt/sbp#readme).

## Usage

```ts
import { createBlogClient, compileToTree } from 'simple-blogs-client'

const blog = createBlogClient({
  baseUrl: process.env.SIMPLE_BLOGS_API_URL!,
  siteSlug: process.env.SIMPLE_BLOGS_SITE_SLUG!,
  siteKey: process.env.SIMPLE_BLOGS_SITE_KEY!,
  compile: async (rawMdx) => compileToTree(rawMdx),
  ttlSeconds: { index: 3600, post: 86400 },
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
- Types: `BlogPost`, `BlogPostSummary`, `BlogFrontmatter`, `BlogAuthor`, `BlogImage`, `BlogListOptions`, `BlogPostResolution`, `BlogProvider`, `TocItem`, `BlogTree`, `CacheHint`, `BlogClientConfig`, `ApiPost`.

## Development

```bash
pnpm install
pnpm test
pnpm run build
```

`pnpm run build` writes ESM output and type declarations to `dist/`.
