import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypePrettyCode, {
  type LineElement,
  type Options as PrettyCodeOptions,
} from 'rehype-pretty-code'
import { unified, type Plugin } from 'unified'
import type { Element, Root, Text } from 'hast'
import { slugify } from './slug'

export type BlogTree = Root

function textOf(node: Root | Element | Text | { type: string; children?: unknown[] }): string {
  if (node.type === 'text') return (node as Text).value
  const children = (node as Root | Element).children as Array<Root | Element | Text> | undefined
  return children ? children.map(textOf).join('') : ''
}

/* Drops h1 (the page renders its own title) and gives h2/h3 ids from their text. */
function rehypeHeadings() {
  return (tree: Root) => {
    const visit = (node: Root | Element) => {
      for (const child of [...node.children]) {
        if (child.type !== 'element') continue
        if (child.tagName === 'h1') {
          node.children.splice(node.children.indexOf(child), 1)
          continue
        }
        if (child.tagName === 'h2' || child.tagName === 'h3') {
          child.properties = { ...child.properties, id: slugify(textOf(child)) }
        }
        visit(child)
      }
    }
    visit(tree)
  }
}

function lastText(node: Root | Element): Text | undefined {
  for (let i = node.children.length - 1; i >= 0; i--) {
    const child = node.children[i]
    if (child.type === 'text') return child
    if (child.type === 'element') {
      const found = lastText(child)
      if (found) return found
    }
  }
}

/* Plain fenced blocks keep a trailing newline from the source, which renders as an empty line. */
function rehypeTrimCodeBlocks() {
  return (tree: Root) => {
    const visit = (node: Root | Element) => {
      for (const child of node.children) {
        if (child.type !== 'element') continue
        if (child.tagName === 'pre') {
          const text = lastText(child)
          if (text) text.value = text.value.replace(/\n+$/, '')
        }
        visit(child)
      }
    }
    visit(tree)
  }
}

/* Same options as the website's MDX pipeline, so highlighted output matches. */
const prettyCodeOptions = {
  theme: 'one-dark-pro' as const,
  keepBackground: false,
  onVisitLine(node: LineElement) {
    if (node.children.length === 0) node.children = [{ type: 'text', value: ' ' }]
  },
  onVisitHighlightedLine(node: LineElement) {
    ;(node.properties.className ??= []).push('line--highlighted')
  },
  onVisitHighlightedWord(node: Element) {
    node.properties.className = ['word--highlighted']
  },
}

const processor = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkGfm)
  .use(remarkRehype, {
    passThrough: [
      'mdxFlowExpression',
      'mdxJsxFlowElement',
      'mdxJsxTextElement',
      'mdxTextExpression',
      'mdxjsEsm',
    ],
  })
  .use(rehypePrettyCode as unknown as Plugin<[PrettyCodeOptions], Root, Root>, prettyCodeOptions)
  .use(rehypeTrimCodeBlocks)
  .use(rehypeHeadings)

/* Compiles MDX source into a plain-JSON hast tree. Pure: no React, no framework imports. */
export async function compileToTree(mdx: string): Promise<BlogTree> {
  const tree = await processor.run(processor.parse(mdx))
  return tree as Root
}
