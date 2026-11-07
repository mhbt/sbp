import { slugify } from './slug'
import type { TocItem } from './types'

/**
 * Extract headings (h2, h3) from raw MDX/markdown content.
 * Skips h1 since it's rendered separately in the page layout.
 * We strip common markdown syntax before slugifying to match the React renderer.
 */
export function extractTableOfContents(rawContent: string): TocItem[] {
  const toc: TocItem[] = []
  // Match ## or ### at the start of a line
  const headingRegex = /^(#{2,3})\s+(.+)$/gm
  let match: RegExpExecArray | null

  while ((match = headingRegex.exec(rawContent)) !== null) {
    const level = match[1].length as 2 | 3
    const rawText = match[2]

    // Strip markdown links [text](url) => text
    const linkText = rawText
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*`]/g, '')
      .trim()
    // The slug keeps underscores inside words, matching the rendered heading id; the label does not.
    const slugSource = linkText.replace(/(?<!\w)_+|_+(?!\w)/g, '').trim()

    toc.push({
      text: linkText.replace(/_/g, '').trim(),
      slug: slugify(slugSource),
      level,
    })
  }

  return toc
}
