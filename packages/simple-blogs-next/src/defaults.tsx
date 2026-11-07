import type { BlogComponents } from './render-tree.js'
import { CodeBlock } from './components/code-block.js'
import { MdxTable, MdxThead, MdxTbody, MdxTr, MdxTh, MdxTd } from './components/mdx-table.js'

/* Default MDX element overrides shipped with the package. Consumers can override any key. */
export const defaultComponents: BlogComponents = {
  table: MdxTable,
  thead: MdxThead,
  tbody: MdxTbody,
  tr: MdxTr,
  th: MdxTh,
  td: MdxTd,
  pre: (props: any) => <CodeBlock {...props} />,
}
