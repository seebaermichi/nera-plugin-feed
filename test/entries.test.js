import { describe, expect, it } from 'vitest'
import { collectEntries, defaultLanguage, isCandidate, isLanguageTag, pageLanguage } from '../src/entries.js'

const POST = 'pages/post.pug'
const page = (href, extra = {}, content = `<p>${href}</p>`) =>
    ({ content, meta: { layout: POST, href, date: '2026-10-01', ...extra } })
const options = { lang: 'en', layouts: [POST] }
const hrefs = (entries) => entries.map((entry) => entry.href)

describe('languages', () => {
    it('accepts language tags only', () => {
        for (const tag of ['en', 'de', 'pt-BR', 'zh-Hant-TW', 'EN']) expect(isLanguageTag(tag)).toBe(true)
        for (const tag of ['', 'en_US', '../x', 'de/at', 'a-', 'toolongtag', 1, null]) expect(isLanguageTag(tag)).toBe(false)
    })

    it('defaults to app.lang, else en; a page to its meta.lang, else the default', () => {
        expect(defaultLanguage({ lang: 'de' })).toBe('de')
        expect(defaultLanguage({})).toBe('en')
        expect(defaultLanguage(undefined)).toBe('en')
        expect(pageLanguage({ lang: 'fr' }, 'de')).toBe('fr')
        expect(pageLanguage({ lang: '' }, 'de')).toBe('de')
    })
})

describe('isCandidate', () => {
    const meta = (extra) => ({ layout: POST, href: '/a.html', ...extra })

    it('takes pages with a listed layout or an include match', () => {
        expect(isCandidate(meta(), { layouts: [POST] })).toBe(true)
        expect(isCandidate(meta({ layout: 'pages/default.pug' }), { layouts: [POST] })).toBe(false)
        expect(isCandidate(meta({ layout: 'pages/default.pug', href: '/notes/x.html' }), { layouts: [POST], include: ['/notes/*'] })).toBe(true)
    })

    it('never takes a page without layout or href, even when included', () => {
        expect(isCandidate({ href: '/a.html' }, { include: ['*'] })).toBe(false)
        expect(isCandidate(meta({ href: '' }), { layouts: [POST] })).toBe(false)
        expect(isCandidate(meta({ href: 42 }), { layouts: [POST] })).toBe(false)
        expect(isCandidate(undefined, { layouts: [POST] })).toBe(false)
    })

    it('leaves out feed: false, noindex (page, else site) and exclude matches', () => {
        expect(isCandidate(meta({ feed: false }), { layouts: [POST] })).toBe(false)
        expect(isCandidate(meta({ robots: 'NoIndex, follow' }), { layouts: [POST] })).toBe(false)
        expect(isCandidate(meta(), { layouts: [POST], robots: 'noindex' })).toBe(false)
        expect(isCandidate(meta({ robots: 'index' }), { layouts: [POST], robots: 'noindex' })).toBe(true)
        expect(isCandidate(meta(), { layouts: [POST], exclude: ['/a.*'] })).toBe(false)
    })
})

describe('collectEntries', () => {
    it('groups by language, languages in string order', () => {
        const { groups } = collectEntries([
            page('/de/a.html', { lang: 'de' }),
            page('/a.html'),
            page('/fr/a.html', { lang: 'fr' }),
            page('/b.html', { lang: 'en' }),
        ], options)
        expect([...groups.keys()]).toEqual(['de', 'en', 'fr'])
        expect(hrefs(groups.get('en'))).toEqual(['/a.html', '/b.html'])
    })

    it('sorts newest first, ties by href, and caps at limit', () => {
        const { groups } = collectEntries([
            page('/old.html', { date: '2025-01-01' }),
            page('/b.html', { date: '2026-10-01' }),
            page('/a.html', { date: '2026-10-01' }),
            page('/new.html', { date: new Date('2026-10-02T08:00:00Z') }),
        ], { ...options, limit: 3 })
        expect(hrefs(groups.get('en'))).toEqual(['/new.html', '/a.html', '/b.html'])
    })

    it('reports undated and bad-language pages in href order and leaves them out', () => {
        const result = collectEntries([
            page('/z.html', { date: undefined }),
            page('/a.html', { date: 'tomorrow' }),
            page('/c.html', { date: undefined, createdAt: new Date() }),
            page('/x.html', { lang: 'en_US' }),
            page('/ok.html'),
        ], options)
        expect(result.undated).toEqual(['/a.html', '/c.html', '/z.html'])
        expect(result.badLanguage).toEqual(['/x.html'])
        expect(hrefs(result.groups.get('en'))).toEqual(['/ok.html'])
    })

    it('keeps the first of duplicate hrefs and carries dates and content', () => {
        const { groups } = collectEntries([
            page('/a.html', { title: 'First', updated: '2026-10-05' }),
            page('/a.html', { title: 'Second' }),
            { meta: { layout: POST, href: '/b.html', date: '2026-09-01' } },
        ], options)
        const [a, b] = groups.get('en')
        expect(a.meta.title).toBe('First')
        expect(a.content).toBe('<p>/a.html</p>')
        expect(a.published.toISOString()).toBe('2026-10-01T00:00:00.000Z')
        expect(a.updated.toISOString()).toBe('2026-10-05T00:00:00.000Z')
        expect(b.content).toBe('')
    })

    it('uses the defaults and survives missing input', () => {
        expect(collectEntries(undefined).groups.size).toBe(0)
        const { groups } = collectEntries([page('/a.html')], { layouts: [POST] })
        expect([...groups.keys()]).toEqual(['en'])
    })
})
