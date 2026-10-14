// The RSS 2.0 serializer (ROADMAP D6, D7 and "XML shapes"). Pure: the same
// resolved feed as `buildAtom` in, the XML string out. `<description>` is
// the summary (else the full HTML), `content:encoded` the full HTML, and the
// item author goes into `dc:creator`, because RSS's own `<author>` must be
// an e-mail address (D8).

import { rfc822 } from './dates.js'
import { escapeXml } from './urls.js'

const NAMESPACES = [
    'xmlns:atom="http://www.w3.org/2005/Atom"',
    'xmlns:content="http://purl.org/rss/1.0/modules/content/"',
    'xmlns:dc="http://purl.org/dc/elements/1.1/"',
].join(' ')

/** The MIME type of an RSS feed. */
export const RSS_TYPE = 'application/rss+xml'

const text = (indent, name, value) => `${indent}<${name}>${escapeXml(value)}</${name}>`

// Plain text (not HTML) in an element RSS readers may treat as HTML:
// `&` and `<` as hexadecimal character references, as the RSS Best
// Practices Profile asks and the W3C Feed Validator checks (D7).
const plain = (indent, name, value) => `${indent}<${name}>${escapeXml(value)
    .replace(/&amp;/g, '&#x26;')
    .replace(/&lt;/g, '&#x3C;')}</${name}>`

function itemLines(entry) {
    const lines = [
        '        <item>',
        plain('            ', 'title', entry.title),
        text('            ', 'link', entry.url),
        `            <guid isPermaLink="true">${escapeXml(entry.url)}</guid>`,
        `            <pubDate>${rfc822(entry.published)}</pubDate>`,
    ]
    if (entry.author) lines.push(plain('            ', 'dc:creator', entry.author))
    for (const tag of entry.tags) lines.push(plain('            ', 'category', tag))
    if (entry.summary) lines.push(plain('            ', 'description', entry.summary))
    else if (entry.html) lines.push(text('            ', 'description', entry.html))
    if (entry.html !== null) lines.push(text('            ', 'content:encoded', entry.html))
    lines.push('        </item>')
    return lines
}

/**
 * The RSS 2.0 XML of one language's feed (see `buildAtom` for `feed`).
 * `<lastBuildDate>` is the newest entry's updated date, never the build
 * time (D4). The channel `<description>` RSS requires is the subtitle, else
 * the title.
 *
 * @param {object} feed
 * @returns {string}
 */
export function buildRss(feed) {
    const updated = new Date(Math.max(...feed.entries.map((entry) => entry.updated)))
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<rss version="2.0" ${NAMESPACES}>`,
        '    <channel>',
        plain('        ', 'title', feed.title),
        text('        ', 'link', feed.homeUrl),
        plain('        ', 'description', feed.subtitle || feed.title),
        text('        ', 'language', feed.lang),
        `        <lastBuildDate>${rfc822(updated)}</lastBuildDate>`,
        `        <atom:link href="${escapeXml(feed.selfUrl)}" rel="self" type="${RSS_TYPE}"/>`,
    ]
    for (const entry of feed.entries) lines.push(...itemLines(entry))
    lines.push('    </channel>', '</rss>')
    return `${lines.join('\n')}\n`
}
