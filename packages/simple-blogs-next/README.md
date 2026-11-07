# simple-blogs-next

Next.js adapter for [simple-blogs-client](../simple-blogs-client/README.md). It turns the compiled blog tree into React elements, and it ships the default code block and table components.

## Install

The packages are distributed as tarballs on [GitHub Releases](https://github.com/mhbt/sbp/releases), not npm. Pin the tarball URLs in `package.json`, then run `pnpm install`. The full steps are in the [sbp guide](https://github.com/mhbt/sbp#install).

```json
{
  "dependencies": {
    "simple-blogs-client": "https://github.com/mhbt/sbp/releases/download/v0.1.0/simple-blogs-client-0.1.0.tgz",
    "simple-blogs-next": "https://github.com/mhbt/sbp/releases/download/v0.1.2/simple-blogs-next-0.1.2.tgz"
  }
}
```

Requires `react` 19 and a Next.js 16 app with the App Router. Install `simple-blogs-client` too, because it is a peer dependency.

## Usage

```ts
// src/lib/blog/provider.ts
import { createBlogClient } from 'simple-blogs-client'
import { createNextCompile } from 'simple-blogs-next'

export const blog = createBlogClient({
  baseUrl: process.env.SIMPLE_BLOGS_API_URL!,
  siteSlug: process.env.SIMPLE_BLOGS_SITE_SLUG!,
  siteKey: process.env.SIMPLE_BLOGS_SITE_KEY!,
  compile: createNextCompile(),
  ttlSeconds: { index: 3600, post: 86400 },
  decorateRequest: (init, cache) => ({ ...init, next: cache }),
})
```

`compile` returns React content, so `resolveBlogPath(slug)` gives a post whose `content` renders directly. `decorateRequest` is required for Next.js cache tags. The complete setup, including the page routes, the Tailwind `@source` line, and revalidation, is in the [sbp guide](https://github.com/mhbt/sbp#setup).

## Components

`createNextCompile(components)` merges your overrides on top of `defaultComponents`. Keys are intrinsic element names such as `h1`, `h2`, `pre`, and `table`:

```ts
import { createNextCompile } from 'simple-blogs-next'

const compile = createNextCompile({
  h1: () => null,
})
```

The example hides the body `h1`, because your page template already renders the title.

`defaultComponents` contains:

| Key | Component |
| --- | --- |
| `pre` | `CodeBlock`: language header, copy button, plain body. Client component. |
| `table`, `thead`, `tbody`, `tr`, `th`, `td` | `MdxTable` and related components |

Overrides win over the defaults, so passing `pre` replaces the code block.

For full control, use `renderTree(tree, components)` with a tree from `compileToTree`.


## Exports

- `createNextCompile(components?)`: returns a `compile` function for `createBlogClient`.
- `renderTree(tree, components)`: turns a `BlogTree` into React nodes.
- `defaultComponents`, `CodeBlock`, `MdxTable`, `MdxThead`, `MdxTbody`, `MdxTr`, `MdxTh`, `MdxTd`.
- Type: `BlogComponents`.

## Development

```bash
pnpm install
pnpm run build
pnpm run typecheck
```

`pnpm run build` compiles with `tsc` to `dist/`. The `'use client'` directive in `CodeBlock` is kept, so the copy button works in the App Router.
