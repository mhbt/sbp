import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Element, Root } from 'hast'
import { compileToTree } from '../src/tree'

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}.mdx`, import.meta.url)), 'utf8')

function elements(node: Root | Element, found: Element[] = []): Element[] {
  for (const child of node.children) {
    if (child.type !== 'element') continue
    found.push(child)
    elements(child, found)
  }
  return found
}

describe('compileToTree', () => {
  it('reproduces the spike numbers for self-hosting-supabase-is-easy', async () => {
    const all = elements(await compileToTree(fixture('fixture-supabase')))
    const headings = all.filter((el) => el.tagName === 'h2' || el.tagName === 'h3')
    expect(headings).toHaveLength(29)
    expect(headings.every((el) => typeof el.properties.id === 'string')).toBe(true)
    expect(all.filter((el) => el.tagName === 'code')).toHaveLength(69)
    expect(all.some((el) => el.tagName === 'h1')).toBe(false)
  })

  it('reproduces the spike numbers for deploy-firestore-rules-with-admin-sdk', async () => {
    const all = elements(await compileToTree(fixture('fixture-firestore')))
    const headings = all.filter((el) => el.tagName === 'h2' || el.tagName === 'h3')
    expect(headings).toHaveLength(9)
    expect(all.filter((el) => el.tagName === 'code')).toHaveLength(37)
    expect(all.filter((el) => el.tagName === 'table')).toHaveLength(1)
  })

  it('gives the ANON_KEY heading the id that the TOC links to', async () => {
    const all = elements(await compileToTree(fixture('fixture-supabase')))
    const ids = all.map((el) => el.properties.id)
    expect(ids).toContain('2-generate-matching-anon_key-and-service_role_key')
  })

  it('returns plain JSON that survives a round trip', async () => {
    const tree = await compileToTree(fixture('fixture-firestore'))
    expect(JSON.parse(JSON.stringify(tree))).toEqual(tree)
  })

  it('drops the trailing newline from plain fenced code blocks', async () => {
    const tree = await compileToTree('```\ngoogle-service-keys.json\n\n```\n')
    const pre = elements(tree).find((el) => el.tagName === 'pre')
    const code = pre?.children[0] as Element
    expect(code.tagName).toBe('code')
    expect(JSON.stringify(code)).toContain('"value":"google-service-keys.json"')
  })
})
