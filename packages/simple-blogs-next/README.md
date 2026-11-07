# simple-blogs-next

Next.js adapter for [simple-blogs-client](../simple-blogs-client/README.md). It turns the compiled blog tree into React elements, and it ships the default code block and table components.

## Install

```bash
pnpm add simple-blogs-next simple-blogs-client
```

Requires `react` 19 and a Next.js app with the App Router.

## Usage

```ts
import { createBlogClient } from 'simple-blogs-client'
import { createNextCompile, renderTree } from 'simple-blogs-next'

const compile = createNextCompile()

const blog = createBlogClient({
  baseUrl: process.env.BLOG_API_URL!,
  siteSlug: 'my-site',
  siteKey: process.env.BLOG_SITE_KEY!,
  compile,
  ttlSeconds: { index: 300, post: 600 },
})
```

`compile` returns React content, so `resolveBlogPath(slug)` gives a post whose `content` can be rendered directly.

## Components

`createNextCompile(components)` merges your overrides on top of `defaultComponents`. Keys are HTML tag names or MDX component names used in the post:

```ts
import { createNextCompile, defaultComponents } from 'simple-blogs-next'

const compile = createNextCompile({
  img: MyImage,
  Callout: MyCallout,
})
```

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
