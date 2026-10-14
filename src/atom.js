// The Atom 1.0 serializer (RFC 4287; ROADMAP D6 and "XML shapes"). Pure:
// a resolved feed in, the XML string out. Every value is escaped here, so
// callers pass plain text and absolute, unescaped URLs.

import { rfc3339 } from './dates.js'
import { escapeXml } from './urls.js'

const NAMESPACE = 'http://www.w3.org/2005/Atom'

/** The MIME type of an Atom feed. */
export const ATOM_TYPE = 'application/atom+xml'

const text = (indent, name, value) => `${indent}<${name}>${escapeXml(value)}</${name}>`

const link = (indent, rel, type, href) =>
    `${indent}<link rel="${rel}" type="${type}" href="${escapeXml(href)}"/>`

const author = (indent, name) => [
    `${indent}<author>`,
    text(`${indent}    `, 'name', name),
    `${indent}</author>`,
]

function entryLines(entry) {
    const lines = [
        '    <entry>',
        text('        ', 'title', entry.title),
        link('        ', 'alternate', 'text/html', entry.url),
        text('        ', 'id', entry.url),
        `        <published>${rfc3339(entry.published)}</published>`,
        `        <updated>${rfc3339(entry.updated)}</updated>`,
    ]
    if (entry.author) lines.push(...author('        ', entry.author))
    for (const tag of entry.tags) lines.push(`        <category term="${escapeXml(tag)}"/>`)
    if (entry.summary) lines.push(`        <summary type="text">${escapeXml(entry.summary)}</summary>`)
    if (entry.html !== null) lines.push(`        <content type="html">${escapeXml(entry.html)}</content>`)
    lines.push('    </entry>')
    return lines
}

/**
 * The Atom XML of one language's feed. The feed's `<updated>` is the newest
 * entry's updated date, never the build time, so the same site gives a
 * byte-identical file (D4).
 *
 * @param {{ lang: string, title: string, subtitle?: string, author: string,
 *   selfUrl: string, homeUrl: string, entries: Array<{ url: string,
 *   title: string, published: Date, updated: Date, author?: string,
 *   tags: string[], summary?: string, html: string|null }> }} feed
 *   `entries` non-empty and already sorted and capped; `html` null when
 *   the config says `content: summary`
 * @returns {string}
 */
export function buildAtom(feed) {
    const updated = new Date(Math.max(...feed.entries.map((entry) => entry.updated)))
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<feed xmlns="${NAMESPACE}" xml:lang="${escapeXml(feed.lang)}">`,
        text('    ', 'title', feed.title),
    ]
    if (feed.subtitle) lines.push(text('    ', 'subtitle', feed.subtitle))
    lines.push(
        link('    ', 'self', ATOM_TYPE, feed.selfUrl),
        link('    ', 'alternate', 'text/html', feed.homeUrl),
        text('    ', 'id', feed.selfUrl),
        `    <updated>${rfc3339(updated)}</updated>`,
        ...author('    ', feed.author),
    )
    for (const entry of feed.entries) lines.push(...entryLines(entry))
    lines.push('</feed>')
    return `${lines.join('\n')}\n`
}
