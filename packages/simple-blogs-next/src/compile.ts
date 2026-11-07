import type { ReactNode } from 'react'
import { compileToTree } from 'simple-blogs-client'
import { renderTree, type BlogComponents } from './render-tree.js'
import { defaultComponents } from './defaults.js'

/* Returns the `compile` function for createBlogClient: raw MDX in, React content out. Overrides win over defaults. */
export function createNextCompile(components: BlogComponents = {}) {
  const merged = { ...defaultComponents, ...components }
  return async (source: string): Promise<ReactNode> => renderTree(await compileToTree(source), merged)
}
