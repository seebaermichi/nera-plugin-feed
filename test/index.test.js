import fs from 'fs'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as plugin from '../index.js'
import { expectWellFormed, tempDir, write } from './helpers.js'

const post = (href, extra = {}) =>
    ({ content: '<p>Hi</p>', meta: { layout: 'pages/post.pug', href, date: '2026-10-01', ...extra } })

const app = { name: 'Demo', lang: 'en', origin: 'https://example.com/' }

let warn
let cwd

beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    cwd = tempDir()
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
})

afterEach(() => {
    vi.restoreAllMocks()
})

const messages = () => warn.mock.calls.map((call) => call.join(' '))

describe('plugin hooks', () => {
    it('exports the synchronous hooks core calls', () => {
        expect(typeof plugin.getAppData).toBe('function')
        expect(typeof plugin.getAssets).toBe('function')
        expect(plugin.getAppData.constructor.name).toBe('Function')
        expect(plugin.getAssets.constructor.name).toBe('Function')
    })

    it('getAppData throws when the site runs a core without getAssets', () => {
        write(path.join(cwd, 'package.json'), '{}')
        write(path.join(cwd, 'node_modules/@nera-static/core/package.json'), '{"name":"@nera-static/core","version":"4.12.0"}')
        expect(() => plugin.getAppData({ app: {}, pagesData: [] })).toThrow(/4\.12\.0 is too old/)
    })
})

describe('getAppData', () => {
    it('returns a new app with app.feeds for every language that has entries', () => {
        const result = plugin.getAppData({ app, pagesData: [post('/a.html'), post('/de/a.html', { lang: 'de' }), post('/fr/x.html', { lang: 'fr', date: null })] })
        expect(result).not.toBe(app)
        expect(result).toEqual({
            ...app,
            feeds: {
                de: [{ format: 'atom', type: 'application/atom+xml', href: '/de/feed.xml', url: 'https://example.com/de/feed.xml', title: 'Demo' }],
                en: [{ format: 'atom', type: 'application/atom+xml', href: '/feed.xml', url: 'https://example.com/feed.xml', title: 'Demo' }],
            },
        })
        expect(warn).not.toHaveBeenCalled()
    })

    it('links no feed without an origin, and never warns (getAssets does)', () => {
        write(path.join(cwd, 'config/feed.yaml'), 'format: nonsense\n')
        expect(plugin.getAppData({ app: { lang: 'en' }, pagesData: [post('/a.html')] }).feeds).toEqual({})
        expect(plugin.getAppData({ app, pagesData: [post('/a.html')] }).feeds.en).toHaveLength(1)
        expect(warn).not.toHaveBeenCalled()
    })

    it('works without arguments', () => {
        expect(plugin.getAppData()).toEqual({ feeds: {} })
    })
})

describe('getAssets', () => {
    it('writes each language\'s feed to the cache and returns the entries for public/', () => {
        const result = plugin.getAssets({ app, pagesData: [post('/a.html'), post('/de/a.html', { lang: 'de' })] })
        const cache = path.join(cwd, '.nera-cache/feed')
        expect(result).toEqual([
            { from: path.join(cache, 'de/feed.xml'), to: 'de/feed.xml' },
            { from: path.join(cache, 'feed.xml'), to: 'feed.xml' },
        ])
        for (const { from } of result) expectWellFormed(fs.readFileSync(from, 'utf-8'))
        expect(warn).not.toHaveBeenCalled()
    })

    it('writes RSS with format: rss and both with format: both', () => {
        write(path.join(cwd, 'config/feed.yaml'), 'format: rss\n')
        expect(plugin.getAssets({ app, pagesData: [post('/a.html')] }).map((entry) => entry.to)).toEqual(['rss.xml'])
        write(path.join(cwd, 'config/feed.yaml'), 'format: both\n')
        expect(plugin.getAssets({ app, pagesData: [post('/a.html')] }).map((entry) => entry.to)).toEqual(['feed.xml', 'rss.xml'])
    })

    it('clears feeds of earlier builds from the cache', () => {
        plugin.getAssets({ app, pagesData: [post('/a.html'), post('/de/a.html', { lang: 'de' })] })
        plugin.getAssets({ app, pagesData: [post('/a.html')] })
        expect(fs.existsSync(path.join(cwd, '.nera-cache/feed/de/feed.xml'))).toBe(false)
    })

    it('warns once without an origin and writes nothing', () => {
        expect(plugin.getAssets({ app: { lang: 'en' }, pagesData: [post('/a.html')] })).toEqual([])
        expect(messages()).toEqual([
            '⚠️ plugin-feed: no site origin, so no feed was written. Set `origin` in ' +
                'config/app.yaml (or `app_origin` in config/canonical-links.yaml).',
        ])
        expect(fs.existsSync(path.join(cwd, '.nera-cache'))).toBe(false)
    })

    it('takes the origin from config/canonical-links.yaml', () => {
        write(path.join(cwd, 'config/canonical-links.yaml'), 'app_origin: https://example.org\n')
        const [entry] = plugin.getAssets({ app: { lang: 'en' }, pagesData: [post('/a.html')] })
        expect(fs.readFileSync(entry.from, 'utf-8')).toContain('<id>https://example.org/a.html</id>')
    })

    it('warns once about undated pages and pages with a bad language', () => {
        plugin.getAssets({ app, pagesData: [post('/a.html'), post('/b.html', { date: undefined }), post('/c.html', { date: 'soon' }), post('/x.html', { lang: 'x_y' })] })
        expect(messages()).toEqual([
            '⚠️ plugin-feed: left out of the feed, because they have no valid date: /b.html, /c.html. ' +
                'Set `date:` in their frontmatter (e.g. `date: 2026-10-14`).',
            '⚠️ plugin-feed: left out of the feed, because their language is not a language tag such as ' +
                'en or pt-BR: /x.html. Fix `lang` in their frontmatter or config/app.yaml.',
        ])
    })

    it('warns when no page is an entry, naming the layouts', () => {
        expect(plugin.getAssets({ app, pagesData: [{ content: '', meta: { layout: 'pages/default.pug', href: '/index.html' } }] })).toEqual([])
        expect(messages()).toEqual([
            '⚠️ plugin-feed: no page is a feed entry, so no feed was written. Entries are pages whose layout is one of ' +
                '"pages/post.pug"; set `layouts` (or `include`) in config/feed.yaml to match your posts.',
        ])
    })

    it('reports config problems', () => {
        write(path.join(cwd, 'config/feed.yaml'), 'limit: many\n')
        plugin.getAssets({ app, pagesData: [post('/a.html')] })
        expect(messages()).toEqual(['⚠️ plugin-feed: config/feed.yaml: invalid limit "many", using 20'])
    })

    it('warns when app.feeds and the written feeds disagree', () => {
        const feeds = { en: [], fr: [] }
        plugin.getAssets({ app: { ...app, feeds }, pagesData: [post('/a.html'), post('/de/a.html', { lang: 'de' })] })
        expect(messages()).toEqual([
            '⚠️ plugin-feed: pages link a feed for fr, but it has no entries, so no feed was written. ' +
                'A plugin running after plugin-feed changed the posts; list plugin-feed under `end:` in config/plugin-order.yaml.',
            '⚠️ plugin-feed: a feed was written for de, but no page links it. ' +
                'A plugin running after plugin-feed changed the posts; list plugin-feed under `end:` in config/plugin-order.yaml.',
        ])
    })

    it('works without arguments', () => {
        expect(plugin.getAssets()).toEqual([])
    })
})
