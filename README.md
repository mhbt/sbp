# sbp: Simple Blogs packages

Reusable packages that render a [Simple Blogs](https://github.com/mhbt/simple-blogs) site inside a Next.js app. The Simple Blogs API is the CMS. Your app fetches posts from it, compiles the MDX, and renders the result.

| Package | Version | What it does | Requires |
| --- | --- | --- | --- |
| [`simple-blogs-client`](./packages/simple-blogs-client) | 0.1.0 | Framework-free API client. Fetches and pages posts, maps them to typed objects, compiles MDX to a tree, and builds a table of contents. | Node.js only |
| [`simple-blogs-next`](./packages/simple-blogs-next) | 0.1.2 | Next.js adapter. Renders the tree as React with a code block, table components, and overridable elements. | React 19, `simple-blogs-client` |

Use `simple-blogs-client` alone if you render with another framework. Add `simple-blogs-next` when you use Next.js.

## Contents

- [Requirements](#requirements)
- [Install](#install)
- [Environment variables](#environment-variables)
- [Setup](#setup)
- [Component overrides](#component-overrides)
- [Caching and revalidation](#caching-and-revalidation)
- [API reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Releasing a new version](#releasing-a-new-version)
- [Development](#development)

## Requirements

- Node.js 20.9 or newer (required by Next.js 16).
- Next.js 16 with the App Router, and React 19.
- pnpm. The reference website is verified on pnpm 10.12.4. The sbp repository itself uses pnpm 12.15.0.
- Tailwind CSS v4 if you use the default code block styling (see [Tailwind source](#1-tailwind-source)).
- A Simple Blogs site with its API base URL, site slug, and site key.

## Install

Packages are not published to npm. Each release attaches the built `.tgz` tarballs to [GitHub Releases](https://github.com/mhbt/sbp/releases). The repository is public, so no token is needed to download them.

Pin the exact tarball URL in your `package.json`:

```json
{
  "dependencies": {
    "simple-blogs-client": "https://github.com/mhbt/sbp/releases/download/v0.1.0/simple-blogs-client-0.1.0.tgz",
    "simple-blogs-next": "https://github.com/mhbt/sbp/releases/download/v0.1.2/simple-blogs-next-0.1.2.tgz"
  }
}
```

Then run:

```bash
pnpm install
```

Install both packages. `simple-blogs-next` declares `simple-blogs-client` as a peer dependency, so the client must be present in your app.

### Which tarball is in which release

Each release only contains the packages that changed. Use the URL that matches the version you want.

| Release | `simple-blogs-client` | `simple-blogs-next` |
| --- | --- | --- |
| [v0.1.0](https://github.com/mhbt/sbp/releases/tag/v0.1.0) | `0.1.0` | `0.1.0` |
| [v0.1.1](https://github.com/mhbt/sbp/releases/tag/v0.1.1) | `0.1.0` | `0.1.1` |
| [v0.1.2](https://github.com/mhbt/sbp/releases/tag/v0.1.2) | (unchanged, use v0.1.0 or v0.1.1) | `0.1.2` |

To upgrade, change the URL to the new version, run `pnpm install`, and commit the updated lockfile.

## Environment variables

The packages do not read environment variables. Your app reads them and passes the values to `createBlogClient`. The names below are the ones the reference website uses. Use them or your own, as long as they reach the client.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SIMPLE_BLOGS_API_URL` | Yes | Absolute URL of the Simple Blogs API. |
| `SIMPLE_BLOGS_SITE_SLUG` | Yes | Your site identifier in the API path. |
| `SIMPLE_BLOGS_SITE_KEY` | Yes | Site key sent to the API. Secret. Keep it on the server. |
| `BLOG_REVALIDATE_SECRET` | For revalidation | HMAC secret shared with the Simple Blogs platform. Secret. |

Example `.env.example` (placeholders only, never commit real values):

```bash
SIMPLE_BLOGS_API_URL=https://api.example.com
SIMPLE_BLOGS_SITE_SLUG=your-site-slug
SIMPLE_BLOGS_SITE_KEY=your-site-key
BLOG_REVALIDATE_SECRET=your-revalidate-secret
```

Use separate values for local development and production. A development environment should point at a development site, so local builds never read production content.

## Setup

These steps follow the reference website. Paths are examples. Adjust them to your project layout.

### 1. Tailwind source

Tailwind CSS v4 scans your project sources for class names. It does not scan `node_modules`, so the code block classes from `simple-blogs-next` are missing unless you add a source line. Add this to your global stylesheet, right after the Tailwind import:

```css
@import "tailwindcss";
@source "../../node_modules/simple-blogs-next/dist";
```

The path is relative to the CSS file, so write it from that file's location to `node_modules/simple-blogs-next/dist`. Without this line, code blocks lose their styling and show plain or light-mode pills.

### 2. Create the blog provider

Create one module that builds the client. Keep it on the server. The site key must never reach the browser.

```ts
// src/lib/blog/provider.ts
import { createBlogClient } from 'simple-blogs-client'
import { createNextCompile } from 'simple-blogs-next'

const compile = createNextCompile()

export const blog = createBlogClient({
  baseUrl: process.env.SIMPLE_BLOGS_API_URL!,
  siteSlug: process.env.SIMPLE_BLOGS_SITE_SLUG!,
  siteKey: process.env.SIMPLE_BLOGS_SITE_KEY!,
  compile,
  ttlSeconds: { index: 86400, post: 1296000 },
  decorateRequest: (init, cache) => ({ ...init, next: cache }),
})
```

Notes:

- `decorateRequest` is how Next.js receives the cache hints. The client builds a `{ revalidate, tags }` hint for each request, and this option copies it onto the `next` fetch option. Without it, requests are not tagged and cannot be revalidated on demand.
- `ttlSeconds.index` controls the post list. `ttlSeconds.post` controls single posts. The values above are the reference website's (1 day for the list, 15 days for posts). Set them to suit how often your content changes.
- Validate the variables at startup if you want clearer errors. The reference site throws a descriptive error when any of them is missing.

### 3. Heading anchors

Table of contents links point at heading IDs. The client builds each `TocItem.slug` with the rule below, so your rendered headings must use the same rule:

1. Lowercase the text.
2. Remove every character that is not a word character, space, or hyphen.
3. Replace runs of whitespace with a single hyphen.
4. Collapse repeated hyphens and trim.

`slugify` is not exported from the package, so keep a copy of this rule in your app. The reference website does this in `src/lib/mdx.tsx`, through `h2` and `h3` overrides (see [Component overrides](#component-overrides)).

### 4. Index page

```tsx
// src/app/blog/page.tsx
import Link from 'next/link'
import { blog } from '@/lib/blog/provider'

export const revalidate = 3600

export default async function BlogIndexPage() {
  const posts = await blog.getBlogPosts()

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.slug}>
          <Link href={`/blog/${post.slug}`}>{post.frontmatter.title}</Link>
        </li>
      ))}
    </ul>
  )
}
```

`getBlogPosts()` follows every page of the API and returns summaries sorted newest first. Pass `{ category: 'engineering' }` to filter by category. The category is slugified for you.

### 5. Post page

Handle all three outcomes of `resolveBlogPath`: a post, a redirect, and not-found. The reference website does this in its post route.

```tsx
// src/app/blog/[slug]/page.tsx
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { blog } from '@/lib/blog/provider'

export const revalidate = 86400

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return []
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const resolution = await blog.resolveBlogPath(slug)

  if (resolution.kind === 'not_found') notFound()
  if (resolution.kind === 'redirect') {
    if (resolution.code === 301) permanentRedirect(resolution.location)
    redirect(resolution.location)
  }

  const { post } = resolution
  return (
    <article>
      <h1>{post.frontmatter.title}</h1>
      <div>{post.content}</div>
    </article>
  )
}
```

`generateStaticParams` returns an empty list on purpose. Posts render on the first request and are then cached. Build time makes no API calls. Use `post.toc` if you render a table of contents, and `post.frontmatter` for metadata. Build your metadata from `frontmatter.seoTitle`, `frontmatter.description`, and the `og*` and `twitter*` fields.

Render `post.content` as the body. Move metadata, JSON-LD, and layout into components so the page stays thin.

### 6. Revalidation endpoint

When a post changes on the Simple Blogs platform, it calls a route in your app. The route verifies a signature and then clears the matching Next.js cache tags or paths. This is optional. Without it, posts refresh when their TTL expires.

The contract below is what the reference website implements in `src/app/api/revalidate/route.ts`. The platform must match it.

**Request**

- Method: `POST`
- Headers:
  - `x-simple-blogs-timestamp`: Unix time in seconds. It must be within 300 seconds of your server's clock.
  - `x-simple-blogs-signature`: `sha256=<hex>`, the HMAC-SHA256 of `${timestamp}.${rawBody}` using `BLOG_REVALIDATE_SECRET`.
- Body (JSON, no other keys allowed):
  - `siteSlug` (optional string)
  - `reason` (optional): `published`, `unpublished`, `updated`, `slug_changed`, `deleted`, or `routes_changed`
  - `paths` (optional array): allowed values are `/`, `/blog`, `/feed.xml`, `/atom.xml`, `/blog-sitemap.xml`, and `/blog/<slug>`
  - `tags` (optional array): allowed values are `blog`, `blog:posts`, `blog:feed`, and `blog:post:<slug>`

**Responses**

| Status | Body `status` | Meaning |
| --- | --- | --- |
| 200 | (`revalidated: true`) | Accepted. Returns the `paths` and `tags` that were cleared. |
| 401 | `UNAUTHORIZED` | Missing or stale timestamp, or the signature does not match. |
| 422 | `INVALID_JSON` or `INVALID_REQUEST` | The body is not JSON, or it fails the schema. |
| 503 | `SERVICE_UNAVAILABLE` | `BLOG_REVALIDATE_SECRET` is not set on this deployment. |

Only allowlisted paths and tags are accepted. Your route should reject anything else. The reference route uses `revalidateTag(tag, { expire: 0 })` for tags and `revalidatePath(path)` for paths.

## Component overrides

`createNextCompile(components)` takes an object that maps element names to React components. Your entries win over the defaults. Keys are intrinsic element names such as `h1`, `h2`, `pre`, and `table`.

```ts
import { createNextCompile } from 'simple-blogs-next'

const compile = createNextCompile({
  h1: () => null,
})
```

The example above hides the body `h1`, because your page template already renders the title. The reference website also overrides `h2` and `h3` to add anchor IDs (see [Heading anchors](#3-heading-anchors)).

Defaults come from `defaultComponents`. The default `pre` is `CodeBlock`, which renders a language header and a copy button. The table elements use `MdxTable`, `MdxThead`, `MdxTbody`, `MdxTr`, `MdxTh`, and `MdxTd`. You can import these and wrap them, for example to add a surrounding element.

Keep overrides small. They render inside your server components, so avoid client-only hooks unless the component itself is a client component.

## Caching and revalidation

The client sends cache hints. Your `decorateRequest` turns them into Next.js `fetch` options. Without `decorateRequest`, requests are plain fetches with no tags.

| Call | Lifetime (seconds) | Tags |
| --- | --- | --- |
| `getBlogPosts()` (index) | `ttlSeconds.index` | `blog`, `blog:posts` |
| `getBlogPosts({ cache: 'postPage' })` | `ttlSeconds.post` | none |
| `resolveBlogPath(slug)` | `ttlSeconds.post` | `blog:post:<slug>` |

`postPage` is for pages that need the full list but should not depend on the list tags. The post page uses it when it builds related-post data.

Tags let you clear the cache for one post or for the whole list. The revalidation route above is the usual way to call `revalidateTag`.

## API reference

### `simple-blogs-client`

```ts
import {
  createBlogClient,
  compileToTree,
  extractTableOfContents,
  mapApiSummary,
  mapApiDetail,
  apiPostSchema,
  apiEnvelopeSchema,
} from 'simple-blogs-client'
```

| Export | Purpose |
| --- | --- |
| `createBlogClient(config)` | Returns a `BlogProvider`. See config below. |
| `compileToTree(mdx)` | Compiles MDX to a hast-based `BlogTree` with syntax highlighting. |
| `extractTableOfContents(rawMdx)` | Returns `TocItem[]` (h2 and h3) from the raw MDX. |
| `mapApiSummary`, `mapApiDetail` | Map API post objects to typed posts. `mapApiDetail` also compiles the body. |
| `apiPostSchema`, `apiEnvelopeSchema` | Zod schemas for the API responses. Types are inferred from them. |

`createBlogClient` config:

| Option | Required | Purpose |
| --- | --- | --- |
| `baseUrl` | Yes | Absolute URL of the API. Trailing slashes are removed. |
| `siteSlug` | Yes | Site identifier in the API path. |
| `siteKey` | Yes | Sent to the API in the `Authorization` header. Keep it on the server. |
| `compile` | Yes | Turns raw MDX into your content type (`TContent`). |
| `ttlSeconds` | Yes | `{ index, post }` lifetimes in seconds. |
| `decorateRequest` | No | `(init, cache) => RequestInit`. Adds host fetch options from a `CacheHint`. |
| `fetch` | No | Replaces the global `fetch`. |

`BlogProvider<TContent>` methods:

- `getBlogPosts(options?)` returns `BlogPostSummary[]`, newest first. Options: `category`, `slugs`, `cache` (`'index'` or `'postPage'`).
- `resolveBlogPath(slug)` returns one of:
  - `{ kind: 'post', post }`
  - `{ kind: 'redirect', location, code }` where `code` is `301` or `302`
  - `{ kind: 'not_found' }`

Errors: non-OK responses other than 404 and redirects throw. Responses with an unexpected envelope throw. The list request follows cursors and stops if a cursor repeats.

Types: `BlogPost`, `BlogPostSummary`, `BlogFrontmatter`, `BlogAuthor`, `BlogImage`, `BlogListOptions`, `BlogPostResolution`, `BlogProvider`, `TocItem`, `BlogTree`, `CacheHint`, `BlogClientConfig`, `ApiPost`. Use `BlogFrontmatter` for the full metadata list (title, date, description, tags, category, SEO and OpenGraph fields, `noindex`, `schemaType`, and more).

### `simple-blogs-next`

```ts
import {
  createNextCompile,
  renderTree,
  defaultComponents,
  CodeBlock,
  MdxTable,
  MdxThead,
  MdxTbody,
  MdxTr,
  MdxTh,
  MdxTd,
} from 'simple-blogs-next'
```

| Export | Purpose |
| --- | --- |
| `createNextCompile(components?)` | Returns the `compile` function for `createBlogClient`. Your overrides win over the defaults. |
| `renderTree(tree, components)` | Renders a `BlogTree` to React elements. Use it directly if you compile yourself. |
| `defaultComponents` | The default element map. Spread it when you build your own map. |
| `BlogComponents` (type) | `Record<string, ComponentType<any>>`. |
| `CodeBlock`, `MdxTable`, `MdxThead`, `MdxTbody`, `MdxTr`, `MdxTh`, `MdxTd` | Default components, exported for reuse. |

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Code blocks are unstyled, or show light pills and a navy band | Tailwind v4 does not scan `node_modules`. Add the `@source` line from [Tailwind source](#1-tailwind-source). |
| Error: `Simple Blogs API requires SIMPLE_BLOGS_API_URL, ...` | An environment variable is missing in that environment. Check `.env` and your hosting settings. |
| `Simple Blogs API request failed (401)` | The site key is wrong or belongs to another site. |
| `Simple Blogs API request failed (404)` on the list | The `baseUrl` or `siteSlug` is wrong. |
| `baseUrl must be an absolute URL.` | Include the scheme, for example `https://`. |
| Table of contents links do not scroll | Heading IDs do not match `TocItem.slug`. Use the same slug rule as [Heading anchors](#3-heading-anchors). |
| Revalidation returns 401 | The secret does not match the platform, or the server clock is more than 300 seconds off. |
| Revalidation returns 503 | `BLOG_REVALIDATE_SECRET` is not set on this deployment. |
| Posts are stale after an edit | Without revalidation, posts refresh when the TTL expires. Set up the [revalidation endpoint](#6-revalidation-endpoint) or lower `ttlSeconds`. |
| Build fails importing `simple-blogs-next` | Check that both tarball URLs are installed, and that `simple-blogs-client` is present for the peer dependency. Run `pnpm install` again. |

## Releasing a new version

Maintainers only. Each package has its own version in its `package.json`. A release tag covers the repository, and each release attaches the tarballs that changed.

```bash
# from the repository root
pnpm install
pnpm -r run typecheck
pnpm --filter simple-blogs-client test
pnpm -r run build

# bump "version" in the package you changed
cd packages/simple-blogs-next
pnpm pack                       # writes simple-blogs-next-<version>.tgz

git tag v<version>
git push origin v<version>
gh release create v<version> ./simple-blogs-next-<version>.tgz --title "v<version>" --notes "..."
```

Build output (`dist/`) is generated by `prepare` and is not committed. Do not commit `.tgz` files. Delete any stray tarballs before you push.

## Development

```bash
pnpm install
pnpm -r run typecheck
pnpm --filter simple-blogs-client test
pnpm -r run build
```

The repository has two packages under `packages/`. `simple-blogs-next` resolves `simple-blogs-client` through a `file:` devDependency, so rebuild the client before you rebuild the adapter.
