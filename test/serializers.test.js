import { describe, expect, it } from 'vitest'
import { buildAtom } from '../src/atom.js'
import { buildRss } from '../src/rss.js'
import { expectWellFormed } from './helpers.js'

const entry = (extra = {}) => ({
    url: 'https://example.com/blog/a.html',
    title: 'A & B',
    published: new Date('2026-10-01T00:00:00Z'),
    updated: new Date('2026-10-05T09:30:00Z'),
    author: null,
    tags: [],
    summary: null,
    html: '<p>Hi</p>',
    ...extra,
})

const feed = (extra = {}) => ({
    lang: 'en',
    title: 'Demo',
    subtitle: null,
    author: 'Demo',
    selfUrl: 'https://example.com/feed.xml',
    homeUrl: 'https://example.com/index.html',
    entries: [entry()],
    ...extra,
})

describe('buildAtom', () => {
    it('writes the documented Atom shape', () => {
        const xml = buildAtom(feed({
            subtitle: 'Notes',
            entries: [
                entry({ author: 'Jane', tags: ['x', 'y & z'], summary: 'Short.' }),
                entry({ url: 'https://example.com/old.html', title: 'Old', published: new Date('2026-01-01T00:00:00Z'), updated: new Date('2026-01-01T00:00:00Z') }),
            ],
        }))
        expect(xml).toBe([
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">',
            '    <title>Demo</title>',
            '    <subtitle>Notes</subtitle>',
            '    <link rel="self" type="application/atom+xml" href="https://example.com/feed.xml"/>',
            '    <link rel="alternate" type="text/html" href="https://example.com/index.html"/>',
            '    <id>https://example.com/feed.xml</id>',
            '    <updated>2026-10-05T09:30:00Z</updated>',
            '    <author>',
            '        <name>Demo</name>',
            '    </author>',
            '    <entry>',
            '        <title>A &amp; B</title>',
            '        <link rel="alternate" type="text/html" href="https://example.com/blog/a.html"/>',
            '        <id>https://example.com/blog/a.html</id>',
            '        <published>2026-10-01T00:00:00Z</published>',
            '        <updated>2026-10-05T09:30:00Z</updated>',
            '        <author>',
            '            <name>Jane</name>',
            '        </author>',
            '        <category term="x"/>',
            '        <category term="y &amp; z"/>',
            '        <summary type="text">Short.</summary>',
            '        <content type="html">&lt;p&gt;Hi&lt;/p&gt;</content>',
            '    </entry>',
            '    <entry>',
            '        <title>Old</title>',
            '        <link rel="alternate" type="text/html" href="https://example.com/old.html"/>',
            '        <id>https://example.com/old.html</id>',
            '        <published>2026-01-01T00:00:00Z</published>',
            '        <updated>2026-01-01T00:00:00Z</updated>',
            '        <content type="html">&lt;p&gt;Hi&lt;/p&gt;</content>',
            '    </entry>',
            '</feed>',
            '',
        ].join('\n'))
        expectWellFormed(xml)
    })

    it('omits subtitle and content when there is none', () => {
        const xml = buildAtom(feed({ entries: [entry({ html: null, summary: 'Only this.' })] }))
        expect(xml).not.toContain('<subtitle>')
        expect(xml).not.toContain('<content')
        expect(xml).toContain('<summary type="text">Only this.</summary>')
        expectWellFormed(xml)
    })

    it('stays well-formed whatever the page text holds', () => {
        const nasty = 'a < b && c > d "q" \'s\' ]]> <![CDATA[ x ]]> \u0001\u0008 &nbsp; 😀'
        const xml = buildAtom(feed({
            title: nasty,
            subtitle: nasty,
            author: nasty,
            selfUrl: 'https://example.com/feed.xml?a=1&b="2"',
            entries: [entry({ title: nasty, author: nasty, tags: [nasty], summary: nasty, html: `<p>${nasty}</p><script>if (a < b) {}</script>` })],
        }))
        expectWellFormed(xml)
    })
})

describe('buildRss', () => {
    it('writes the documented RSS 2.0 shape', () => {
        const xml = buildRss(feed({
            subtitle: 'Notes',
            entries: [entry({ author: 'Jane', tags: ['x'], summary: 'Short.' })],
        }))
        expect(xml).toBe([
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">',
            '    <channel>',
            '        <title>Demo</title>',
            '        <link>https://example.com/index.html</link>',
            '        <description>Notes</description>',
            '        <language>en</language>',
            '        <lastBuildDate>Mon, 05 Oct 2026 09:30:00 GMT</lastBuildDate>',
            '        <atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml"/>',
            '        <item>',
            '            <title>A &#x26; B</title>',
            '            <link>https://example.com/blog/a.html</link>',
            '            <guid isPermaLink="true">https://example.com/blog/a.html</guid>',
            '            <pubDate>Thu, 01 Oct 2026 00:00:00 GMT</pubDate>',
            '            <dc:creator>Jane</dc:creator>',
            '            <category>x</category>',
            '            <description>Short.</description>',
            '            <content:encoded>&lt;p&gt;Hi&lt;/p&gt;</content:encoded>',
            '        </item>',
            '    </channel>',
            '</rss>',
            '',
        ].join('\n'))
        expectWellFormed(xml)
    })

    it('falls back to the title for the channel and to the HTML for an item description', () => {
        const xml = buildRss(feed())
        expect(xml).toContain('        <description>Demo</description>')
        expect(xml).toContain('            <description>&lt;p&gt;Hi&lt;/p&gt;</description>')
        expectWellFormed(xml)
    })

    it('writes & and < in plain-text elements as hexadecimal character references', () => {
        const xml = buildRss(feed({
            title: 'Tom & <Jerry>',
            entries: [entry({ title: 'a < b & c', author: 'A & B', tags: ['x & y'], summary: '1 < 2 & 3' })],
        }))
        expect(xml).toContain('        <title>Tom &#x26; &#x3C;Jerry&gt;</title>')
        expect(xml).toContain('        <description>Tom &#x26; &#x3C;Jerry&gt;</description>')
        expect(xml).toContain('            <title>a &#x3C; b &#x26; c</title>')
        expect(xml).toContain('            <dc:creator>A &#x26; B</dc:creator>')
        expect(xml).toContain('            <category>x &#x26; y</category>')
        expect(xml).toContain('            <description>1 &#x3C; 2 &#x26; 3</description>')
        expect(xml).toContain('            <content:encoded>&lt;p&gt;Hi&lt;/p&gt;</content:encoded>')
        expectWellFormed(xml)
    })

    it('writes neither description nor content:encoded for a summary-mode item without summary', () => {
        const xml = buildRss(feed({ entries: [entry({ html: null })] }))
        expect(xml).not.toContain('<content:encoded>')
        expect(xml.match(/<description>/g)).toHaveLength(1)
        expectWellFormed(xml)
    })
})
