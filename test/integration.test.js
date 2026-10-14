import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { describe, it, expect, beforeAll } from 'vitest'
import { build, expectWellFormed, tempDir, write } from './helpers.js'

// End to end through core's real pipeline (ROADMAP slice 6): a throwaway
// site in a temp dir loads this repo's index.js as a local plugin from its
// `plugins/` folder, and `run()` builds it — core's frontmatter parsing,
// every plugin hook, page rendering with the published partial, and the
// `getAssets` copy into public/.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginEntry = path.join(root, 'index.js')
const partial = fs.readFileSync(path.join(root, 'views/feed-link.pug'), 'utf-8')

const page = (frontmatter, body = 'Text.') => `---\n${frontmatter}\n---\n${body}\n`

const LAYOUT = [
    'doctype html',
    'html(lang=meta.lang || app.lang)',
    '  head',
    '    title= meta.title',
    '    include ../vendor/plugin-feed/feed-link',
    '  body',
    '    main!= content',
    '',
].join('\n')

/**
 * A bilingual site (en at the root, de under /de) with one post for each
 * D3/D4 case and the partial published to views/vendor/. `files` adds or
 * overrides site files by relative path.
 */
function makeSite(dir, files = {}) {
    const post = 'layout: pages/post.pug'
    const site = {
        'package.json': JSON.stringify({ name: 'demo', private: true, type: 'module' }),
        'config/app.yaml': 'name: Demo\nlang: en\norigin: https://example.com/\n' +
            'translations:\n  de:\n    app_description: Ein Blog über Nera\n',
        'views/pages/post.pug': LAYOUT,
        'views/pages/default.pug': LAYOUT,
        'views/vendor/plugin-feed/feed-link.pug': partial,
        'plugins/feed/index.js': `export * from '${pathToFileURL(pluginEntry).href}'\n`,
        'pages/index.md': page('title: Home\nlayout: pages/default.pug'),
        'pages/blog/hello.md': page(
            `title: Hello & welcome\n${post}\ndate: 2026-10-01\nupdated: 2026-10-05\n` +
                'description: The first post.\ntags: nera, blog',
            'See [about](/about.html) and ![a cat](img/cat.png "Cat").'
        ),
        'pages/blog/second.md': page(`title: Second\n${post}\ndate: 2026-10-03T08:00:00Z\nauthor: Jane`, 'Short <em>and</em> sweet.'),
        'pages/blog/hidden.md': page(`title: Hidden\n${post}\ndate: 2026-10-04\nfeed: false`),
        'pages/blog/private.md': page(`title: Private\n${post}\ndate: 2026-10-04\nrobots: noindex, follow`),
        'pages/blog/undated.md': page(`title: Undated\n${post}`),
        'pages/blog/fragment.md': page('title: No layout, never rendered\ndate: 2026-10-04'),
        'pages/de/index.md': page('title: Start\nlayout: pages/default.pug\nlang: de'),
        'pages/de/blog/hallo.md': page(`title: Hallo\n${post}\nlang: de\ndate: 2026-09-01\nlead: Der erste Beitrag.`, 'Siehe [Start](../index.html).'),
        ...files,
    }
    for (const [rel, content] of Object.entries(site)) write(path.join(dir, rel), content)
}

const read = (dir, rel) => fs.readFileSync(path.join(dir, 'public', rel), 'utf-8')
const exists = (dir, rel) => fs.existsSync(path.join(dir, 'public', rel))

const UNDATED_WARNING = '⚠️ plugin-feed: left out of the feed, because they have no valid date: ' +
    '/blog/undated.html. Set `date:` in their frontmatter (e.g. `date: 2026-10-14`).'

const FEED_EN = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">',
    '    <title>Demo</title>',
    '    <link rel="self" type="application/atom+xml" href="https://example.com/feed.xml"/>',
    '    <link rel="alternate" type="text/html" href="https://example.com/index.html"/>',
    '    <id>https://example.com/feed.xml</id>',
    '    <updated>2026-10-05T00:00:00Z</updated>',
    '    <author>',
    '        <name>Demo</name>',
    '    </author>',
    '    <entry>',
    '        <title>Second</title>',
    '        <link rel="alternate" type="text/html" href="https://example.com/blog/second.html"/>',
    '        <id>https://example.com/blog/second.html</id>',
    '        <published>2026-10-03T08:00:00Z</published>',
    '        <updated>2026-10-03T08:00:00Z</updated>',
    '        <author>',
    '            <name>Jane</name>',
    '        </author>',
    '        <content type="html">&lt;p&gt;Short &lt;em&gt;and&lt;/em&gt; sweet.&lt;/p&gt;\n</content>',
    '    </entry>',
    '    <entry>',
    '        <title>Hello &amp; welcome</title>',
    '        <link rel="alternate" type="text/html" href="https://example.com/blog/hello.html"/>',
    '        <id>https://example.com/blog/hello.html</id>',
    '        <published>2026-10-01T00:00:00Z</published>',
    '        <updated>2026-10-05T00:00:00Z</updated>',
    '        <category term="nera"/>',
    '        <category term="blog"/>',
    '        <summary type="text">The first post.</summary>',
    '        <content type="html">&lt;p&gt;See &lt;a href=&quot;https://example.com/about.html&quot;&gt;about&lt;/a&gt; ' +
        'and &lt;img src=&quot;https://example.com/blog/img/cat.png&quot; alt=&quot;a cat&quot; title=&quot;Cat&quot;&gt;.&lt;/p&gt;\n</content>',
    '    </entry>',
    '</feed>',
    '',
].join('\n')

const FEED_DE = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="de">',
    '    <title>Demo</title>',
    '    <subtitle>Ein Blog über Nera</subtitle>',
    '    <link rel="self" type="application/atom+xml" href="https://example.com/de/feed.xml"/>',
    '    <link rel="alternate" type="text/html" href="https://example.com/de/index.html"/>',
    '    <id>https://example.com/de/feed.xml</id>',
    '    <updated>2026-09-01T00:00:00Z</updated>',
    '    <author>',
    '        <name>Demo</name>',
    '    </author>',
    '    <entry>',
    '        <title>Hallo</title>',
    '        <link rel="alternate" type="text/html" href="https://example.com/de/blog/hallo.html"/>',
    '        <id>https://example.com/de/blog/hallo.html</id>',
    '        <published>2026-09-01T00:00:00Z</published>',
    '        <updated>2026-09-01T00:00:00Z</updated>',
    '        <summary type="text">Der erste Beitrag.</summary>',
    '        <content type="html">&lt;p&gt;Siehe &lt;a href=&quot;https://example.com/de/index.html&quot;&gt;Start&lt;/a&gt;.&lt;/p&gt;\n</content>',
    '    </entry>',
    '</feed>',
    '',
].join('\n')

describe('a bilingual site without config/feed.yaml', () => {
    let dir
    let warnings

    beforeAll(async () => {
        dir = tempDir('nera-feed-int-')
        makeSite(dir)
        warnings = await build(dir)
    }, 60_000)

    it('warns only about the undated post', () => {
        expect(warnings).toEqual([UNDATED_WARNING])
    })

    it('writes the default language\'s Atom feed at public/feed.xml', () => {
        expect(read(dir, 'feed.xml')).toBe(FEED_EN)
        expectWellFormed(read(dir, 'feed.xml'))
    })

    it('writes the German feed at public/de/feed.xml, with only German posts', () => {
        expect(read(dir, 'de/feed.xml')).toBe(FEED_DE)
        expectWellFormed(read(dir, 'de/feed.xml'))
    })

    it('writes no RSS by default', () => {
        expect(exists(dir, 'rss.xml')).toBe(false)
        expect(exists(dir, 'de/rss.xml')).toBe(false)
    })

    it('renders the left-out posts, so they are missing only from the feed', () => {
        for (const rel of ['blog/hidden.html', 'blog/private.html', 'blog/undated.html']) expect(exists(dir, rel)).toBe(true)
        expect(exists(dir, 'blog/fragment.html')).toBe(false)
    })

    it('links each page\'s own language feed in its head', () => {
        const en = '<link rel="alternate" type="application/atom+xml" href="/feed.xml" title="Demo">'
        const de = '<link rel="alternate" type="application/atom+xml" href="/de/feed.xml" title="Demo">'
        expect(read(dir, 'index.html')).toContain(en)
        expect(read(dir, 'blog/hello.html')).toContain(en)
        expect(read(dir, 'de/blog/hallo.html')).toContain(de)
        expect(read(dir, 'de/blog/hallo.html')).not.toContain('href="/feed.xml"')
    })

    it('writes byte-identical feeds on a second build', async () => {
        const first = [read(dir, 'feed.xml'), read(dir, 'de/feed.xml')]
        expect(await build(dir)).toEqual([UNDATED_WARNING])
        expect([read(dir, 'feed.xml'), read(dir, 'de/feed.xml')]).toEqual(first)
    }, 60_000)
})

describe('a site deployed under base_path with format: both', () => {
    let dir
    let warnings

    beforeAll(async () => {
        dir = tempDir('nera-feed-int-')
        makeSite(dir, {
            'config/app.yaml': 'name: Demo\nlang: en\nbase_path: /sub/\n',
            'config/canonical-links.yaml': 'app_origin: https://example.org\n',
            'config/feed.yaml': 'format: both\nexclude:\n    - /blog/undated.html\n',
            'pages/blog/third.md': page(
                'title: Third\nlayout: pages/post.pug\ndate: 2026-10-04',
                '<picture><source srcset="/img/a.webp 1x, img/b.webp 2x"><img src="/sub/img/a.png" alt=""></picture>'
            ),
        })
        warnings = await build(dir)
    }, 60_000)

    it('builds without warnings', () => {
        expect(warnings).toEqual([])
    })

    it('writes Atom and RSS for both languages, every one well-formed', () => {
        for (const rel of ['feed.xml', 'rss.xml', 'de/feed.xml', 'de/rss.xml']) expectWellFormed(read(dir, rel))
    })

    it('prefixes every URL with base_path exactly once, in links, ids and content', () => {
        for (const rel of ['feed.xml', 'rss.xml', 'de/feed.xml', 'de/rss.xml']) {
            const xml = read(dir, rel)
            const urls = [...xml.matchAll(/https?:\/\/[^\s"<&]+/g)].map((match) => match[0])
                .filter((url) => !/w3\.org|purl\.org/.test(url))
            expect(urls.length).toBeGreaterThan(3)
            for (const url of urls) {
                expect(url).toMatch(/^https:\/\/example\.org\/sub\//)
                expect(url).not.toMatch(/\/sub\/sub\//)
            }
        }
        const atom = read(dir, 'feed.xml')
        expect(atom).toContain('srcset=&quot;https://example.org/sub/img/a.webp 1x, https://example.org/sub/blog/img/b.webp 2x&quot;')
        expect(atom).toContain('src=&quot;https://example.org/sub/img/a.png&quot;')
    })

    it('writes the RSS shape with content:encoded and the description as summary', () => {
        const rss = read(dir, 'rss.xml')
        expect(rss).toContain('        <atom:link href="https://example.org/sub/rss.xml" rel="self" type="application/rss+xml"/>')
        expect(rss).toContain('        <link>https://example.org/sub/index.html</link>')
        expect(rss).toContain('            <guid isPermaLink="true">https://example.org/sub/blog/hello.html</guid>')
        expect(rss).toContain('            <pubDate>Thu, 01 Oct 2026 00:00:00 GMT</pubDate>')
        expect(rss).toContain('            <description>The first post.</description>')
        expect(rss).toContain('<content:encoded>&lt;p&gt;See &lt;a href=&quot;https://example.org/sub/about.html&quot;')
        expect([...rss.matchAll(/<link>(.*)<\/link>/g)].map((match) => match[1])).toEqual([
            'https://example.org/sub/index.html',
            'https://example.org/sub/blog/third.html',
            'https://example.org/sub/blog/second.html',
            'https://example.org/sub/blog/hello.html',
        ])
    })

    it('links both feeds in the head, prefixed once', () => {
        const html = read(dir, 'blog/hello.html')
        expect(html).toContain('<link rel="alternate" type="application/atom+xml" href="/sub/feed.xml" title="Demo">')
        expect(html).toContain('<link rel="alternate" type="application/rss+xml" href="/sub/rss.xml" title="Demo">')
    })
})

describe('a site with content: summary and a limit', () => {
    let dir
    let warnings

    beforeAll(async () => {
        dir = tempDir('nera-feed-int-')
        makeSite(dir, {
            'config/feed.yaml': 'content: summary\nlimit: 1\ntitle:\n    de: Mein Blog\n',
            'pages/blog/undated.md': page('title: Undated, not a post\nlayout: pages/default.pug'),
        })
        warnings = await build(dir)
    }, 60_000)

    it('builds without warnings', () => {
        expect(warnings).toEqual([])
    })

    it('keeps only the newest entry, without content', () => {
        const xml = read(dir, 'feed.xml')
        expectWellFormed(xml)
        expect([...xml.matchAll(/<id>(.*)<\/id>/g)].map((match) => match[1])).toEqual([
            'https://example.com/feed.xml',
            'https://example.com/blog/second.html',
        ])
        expect(xml).not.toContain('<content')
    })

    it('keeps the summary and the per-language title', () => {
        const xml = read(dir, 'de/feed.xml')
        expectWellFormed(xml)
        expect(xml).toContain('    <title>Mein Blog</title>')
        expect(xml).toContain('<summary type="text">Der erste Beitrag.</summary>')
        expect(xml).not.toContain('<content')
        expect(read(dir, 'de/index.html')).toContain('title="Mein Blog"')
    })
})

describe('a site without an origin', () => {
    let dir
    let warnings

    beforeAll(async () => {
        dir = tempDir('nera-feed-int-')
        makeSite(dir, { 'config/app.yaml': 'name: Demo\nlang: en\n' })
        warnings = await build(dir)
    }, 60_000)

    it('warns once and writes no feed and no link (D2)', () => {
        expect(warnings).toHaveLength(1)
        expect(warnings[0]).toMatch(/^⚠️ plugin-feed: no site origin/)
        expect(exists(dir, 'feed.xml')).toBe(false)
        expect(exists(dir, 'de/feed.xml')).toBe(false)
        expect(read(dir, 'blog/hello.html')).not.toContain('rel="alternate"')
    })
})
