import { describe, expect, it } from 'vitest'
import { defaults } from '../src/config.js'
import { collectEntries } from '../src/entries.js'
import {
    buildFeeds, entryTags, entryView, feedAuthor, feedLinks, feedPath, feedSubtitle, feedTitle, homeHref,
} from '../src/feeds.js'
import { expectWellFormed } from './helpers.js'

const origin = 'https://example.com'

describe('paths', () => {
    it('puts the default language at the root and the others in their folder', () => {
        expect(feedPath('en', 'en', 'atom')).toBe('feed.xml')
        expect(feedPath('en', 'en', 'rss')).toBe('rss.xml')
        expect(feedPath('de', 'en', 'atom')).toBe('de/feed.xml')
        expect(feedPath('pt-BR', 'en', 'rss')).toBe('pt-BR/rss.xml')
    })

    it('links the language\'s index page when it is rendered, else its folder', () => {
        const pagesData = [
            { meta: { layout: 'x.pug', href: '/index.html' } },
            { meta: { href: '/de/index.html' } },
        ]
        expect(homeHref('en', 'en', pagesData)).toBe('/index.html')
        expect(homeHref('de', 'en', pagesData)).toBe('/de/')
        expect(homeHref('en', 'en')).toBe('/')
    })
})

describe('titles and authors', () => {
    const app = { name: ' Demo ', translations: { de: { app_description: 'Ein Blog' } } }

    it('takes the title from config (string or per language), else app.name, else the host', () => {
        expect(feedTitle({ config: { title: 'Blog' }, app, lang: 'de', origin })).toBe('Blog')
        expect(feedTitle({ config: { title: { de: 'Mein Blog' } }, app, lang: 'de', origin })).toBe('Mein Blog')
        expect(feedTitle({ config: { title: { de: 'Mein Blog' } }, app, lang: 'en', origin })).toBe('Demo')
        expect(feedTitle({ config: {}, app: {}, lang: 'en', origin: 'https://example.com:8080' })).toBe('example.com:8080')
    })

    it('takes the subtitle from config, else the app_description translation, else none', () => {
        expect(feedSubtitle({ config: { subtitle: { en: 'Notes' } }, app, lang: 'en' })).toBe('Notes')
        expect(feedSubtitle({ config: {}, app, lang: 'de' })).toBe('Ein Blog')
        expect(feedSubtitle({ config: {}, app, lang: 'en' })).toBeNull()
        expect(feedSubtitle({ config: {}, app: {}, lang: 'en' })).toBeNull()
    })

    it('takes the author from config, else app.name, else the title', () => {
        expect(feedAuthor({ config: { author: 'Jane' }, app, title: 'T' })).toBe('Jane')
        expect(feedAuthor({ config: {}, app, title: 'T' })).toBe('Demo')
        expect(feedAuthor({ config: {}, app: {}, title: 'T' })).toBe('T')
    })
})

describe('entries', () => {
    it('reads tags as a list or a comma-separated string', () => {
        expect(entryTags({ tags: ['a', ' b ', 'a', '', 3] })).toEqual(['a', 'b'])
        expect(entryTags({ tags: 'nera, blog,,nera' })).toEqual(['nera', 'blog'])
        expect(entryTags({})).toEqual([])
    })

    it('builds the view model with absolute URLs and the summary', () => {
        const entry = {
            href: '/blog/a.html',
            meta: { title: ' A ', author: 'Jane', lead: 'Lead.', tags: 'x' },
            content: '<img src="a.png">',
            published: new Date('2026-10-01T00:00:00Z'),
            updated: new Date('2026-10-02T00:00:00Z'),
        }
        expect(entryView(entry, { origin, basePath: '/sub', content: 'full' })).toEqual({
            url: 'https://example.com/sub/blog/a.html',
            title: 'A',
            published: entry.published,
            updated: entry.updated,
            author: 'Jane',
            tags: ['x'],
            summary: 'Lead.',
            html: '<img src="https://example.com/sub/blog/a.png">',
        })
        const bare = entryView({ ...entry, meta: { description: 'D', lead: 'L' } }, { origin, content: 'summary' })
        expect(bare).toMatchObject({ title: '/blog/a.html', author: null, summary: 'D', html: null })
    })
})

describe('feedLinks', () => {
    it('describes each language\'s feeds with base_path in href and an absolute url', () => {
        const config = { ...defaults(), format: 'both', title: { de: 'Blog' } }
        expect(feedLinks({ languages: ['de', 'en'], defaultLang: 'en', config, app: { name: 'Demo', basePath: '/sub' }, origin })).toEqual({
            de: [
                { format: 'atom', type: 'application/atom+xml', href: '/sub/de/feed.xml', url: 'https://example.com/sub/de/feed.xml', title: 'Blog' },
                { format: 'rss', type: 'application/rss+xml', href: '/sub/de/rss.xml', url: 'https://example.com/sub/de/rss.xml', title: 'Blog' },
            ],
            en: [
                { format: 'atom', type: 'application/atom+xml', href: '/sub/feed.xml', url: 'https://example.com/sub/feed.xml', title: 'Demo' },
                { format: 'rss', type: 'application/rss+xml', href: '/sub/rss.xml', url: 'https://example.com/sub/rss.xml', title: 'Demo' },
            ],
        })
    })

    it('is empty without languages', () => {
        expect(feedLinks({ languages: [], defaultLang: 'en', config: defaults(), app: {}, origin })).toEqual({})
    })
})

describe('buildFeeds', () => {
    const pagesData = [
        { content: '<p>en</p>', meta: { layout: 'pages/post.pug', href: '/blog/a.html', title: 'A', date: '2026-10-01' } },
        { content: '<p>de</p>', meta: { layout: 'pages/post.pug', href: '/de/blog/a.html', title: 'A (de)', lang: 'de', date: '2026-10-02' } },
    ]

    it('writes one well-formed file per language and format, Atom first', () => {
        const config = { ...defaults(), format: 'both' }
        const { groups } = collectEntries(pagesData, { lang: 'en', layouts: config.layouts })
        const files = buildFeeds({ groups, defaultLang: 'en', pagesData, config, app: { name: 'Demo' }, origin })
        expect(files.map((file) => file.to)).toEqual(['de/feed.xml', 'de/rss.xml', 'feed.xml', 'rss.xml'])
        for (const { xml } of files) expectWellFormed(xml)
        expect(files[0].xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="de">')
        expect(files[0].xml).toContain('<link rel="self" type="application/atom+xml" href="https://example.com/de/feed.xml"/>')
        expect(files[0].xml).toContain('<link rel="alternate" type="text/html" href="https://example.com/de/"/>')
        expect(files[0].xml).toContain('<id>https://example.com/de/blog/a.html</id>')
        expect(files[0].xml).not.toContain('<id>https://example.com/blog/a.html</id>')
        expect(files[3].xml).toContain('<language>en</language>')
    })

    it('writes nothing without groups', () => {
        expect(buildFeeds({ groups: new Map(), defaultLang: 'en', pagesData, config: defaults(), app: {}, origin })).toEqual([])
    })
})
