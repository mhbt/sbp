import type { ComponentType, ReactNode } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import type { BlogTree } from 'simple-blogs-client'

export type BlogComponents = Record<string, ComponentType<any>>

/* Turns a compiled blog tree into React elements. Tags and MDX components are looked up in `components`. */
export function renderTree(tree: BlogTree, components: BlogComponents): ReactNode {
  return toJsxRuntime(tree, { Fragment, jsx, jsxs, components })
}
