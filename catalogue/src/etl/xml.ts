import { createReadStream } from 'node:fs'
import { createGunzip } from 'node:zlib'
import type { Readable } from 'node:stream'

import sax from 'sax'

/**
 * Reading the dump one entity at a time.
 *
 * The four files are 70–110 GB of XML unpacked, and nobody unpacks them: this
 * streams the gzip, hands each top-level element — one `<release>`, one
 * `<artist>` — to the caller as a small tree, and forgets it. Memory is one
 * entity at a time, whatever the file size.
 *
 * A tree rather than SAX events all the way up, because the shaping in
 * `shape.ts` wants to say "the labels of this release" and not keep a state
 * machine per table. An entity is a few kilobytes; the tree costs nothing.
 *
 * `sax` in strict mode: the dump is well-formed XML, and a parser that guesses
 * would guess wrong silently somewhere in row eleven million.
 */
export interface XmlNode {
  name: string
  attrs: Record<string, string>
  text: string
  children: XmlNode[]
}

/** Every `<tag>` directly under the root, in file order. */
export async function* entities(stream: Readable, tag: string): AsyncGenerator<XmlNode> {
  const parser = sax.parser(true, { trim: false })
  const stack: XmlNode[] = []
  let depth = 0
  let ready: XmlNode[] = []
  let failure: Error | null = null

  parser.onerror = (error) => {
    failure = error
    // sax keeps going after an error unless told otherwise; the dump is
    // either well-formed or the build is wrong, so it stops here.
    parser.error = null
  }
  parser.onopentag = (node) => {
    depth += 1
    if (depth === 1) return // the root: <releases>, <artists>, …
    const attrs: Record<string, string> = {}
    for (const [key, value] of Object.entries(node.attributes)) attrs[key] = String(value)
    const child: XmlNode = { name: node.name, attrs, text: '', children: [] }
    const parent = stack[stack.length - 1]
    if (parent) parent.children.push(child)
    stack.push(child)
  }
  parser.ontext = (text) => {
    const top = stack[stack.length - 1]
    if (top) top.text += text
  }
  parser.oncdata = parser.ontext
  parser.onclosetag = (name) => {
    depth -= 1
    if (depth === 0) return
    const done = stack.pop()
    if (done && stack.length === 0 && name === tag) ready.push(done)
  }

  for await (const chunk of stream) {
    parser.write(chunk instanceof Buffer ? chunk.toString('utf8') : String(chunk))
    if (failure) throw failure
    if (ready.length > 0) {
      const batch = ready
      ready = []
      yield* batch
    }
  }
  // A truncated file (a cut, a partial download) ends mid-element: what was
  // complete has been handed over, and the rest is nobody's row.
  if (stack.length === 0) parser.close()
  if (failure) throw failure
  yield* ready
}

/** A dump file, gzipped or not — the fixture is small enough to keep either way. */
export function openDump(path: string): Readable {
  const raw = createReadStream(path)
  return path.endsWith('.gz') ? raw.pipe(createGunzip()) : raw
}

export function child(node: XmlNode, name: string): XmlNode | undefined {
  return node.children.find((c) => c.name === name)
}

export function children(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((c) => c.name === name)
}

export function text(node: XmlNode | undefined, name?: string): string {
  const target = name && node ? child(node, name) : node
  return target?.text ?? ''
}

/* Writing it back out, for the cut: the same shape the dump has. */

function escape(value: string, attribute = false): string {
  const base = value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return attribute ? base.replaceAll('"', '&quot;') : base
}

export function serialise(node: XmlNode): string {
  const attrs = Object.entries(node.attrs)
    .map(([key, value]) => ` ${key}="${escape(value, true)}"`)
    .join('')
  if (node.children.length === 0 && node.text === '') return `<${node.name}${attrs}/>`
  return `<${node.name}${attrs}>${escape(node.text)}${node.children.map(serialise).join('')}</${node.name}>`
}
