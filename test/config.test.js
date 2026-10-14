import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getConfig } from '@nera-static/plugin-utils'
import { defaults, loadConfig, normalizeConfig, resolveOrigin } from '../src/config.js'
import { tempDir, write } from './helpers.js'

const packagedConfig = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../config/feed.yaml')

let warn

beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

const messages = () => warn.mock.calls.map((call) => call.join(' '))

describe('normalizeConfig', () => {
    it('returns the defaults for an empty or missing config', () => {
        expect(normalizeConfig({})).toEqual(defaults())
        expect(normalizeConfig(null)).toEqual(defaults())
        expect(normalizeConfig(undefined)).toEqual(defaults())
        expect(warn).not.toHaveBeenCalled()
    })

    it('defaults match the ROADMAP configuration and the packaged config/feed.yaml', () => {
        expect(defaults()).toEqual({
            format: 'atom',
            layouts: ['pages/post.pug'],
            include: [],
            exclude: [],
            limit: 20,
            content: 'full',
            title: null,
            subtitle: null,
            author: null,
        })
        expect(normalizeConfig(getConfig(packagedConfig))).toEqual(defaults())
        expect(warn).not.toHaveBeenCalled()
    })

    it('takes valid values', () => {
        expect(normalizeConfig({
            format: 'both',
            layouts: 'pages/article.pug',
            include: ['/notes/*'],
            exclude: [' /drafts/* '],
            limit: 5,
            content: 'summary',
            title: { en: 'Blog', de: 'Blog (de)' },
            subtitle: ' Notes ',
            author: 'Jane',
        })).toEqual({
            format: 'both',
            layouts: ['pages/article.pug'],
            include: ['/notes/*'],
            exclude: ['/drafts/*'],
            limit: 5,
            content: 'summary',
            title: { en: 'Blog', de: 'Blog (de)' },
            subtitle: 'Notes',
            author: 'Jane',
        })
        expect(warn).not.toHaveBeenCalled()
    })

    it('warns on invalid values and falls back to the defaults', () => {
        const config = normalizeConfig({
            format: 'json',
            layouts: { a: 1 },
            limit: 0,
            content: 'html',
            title: 42,
            author: ['x'],
        })
        expect(config).toEqual(defaults())
        expect(messages()).toEqual([
            '⚠️ plugin-feed: config/feed.yaml: invalid format "json", using "atom"',
            '⚠️ plugin-feed: config/feed.yaml: invalid layouts {"a":1}, using ["pages/post.pug"]',
            '⚠️ plugin-feed: config/feed.yaml: invalid limit 0, using 20',
            '⚠️ plugin-feed: config/feed.yaml: invalid content "html", using "full"',
            '⚠️ plugin-feed: config/feed.yaml: invalid title 42, ignoring it',
            '⚠️ plugin-feed: config/feed.yaml: invalid author ["x"], ignoring it',
        ])
    })

    it('rejects limits that are not whole numbers of at least 1', () => {
        for (const limit of [-1, 2.5, '10', true]) {
            expect(normalizeConfig({ limit }).limit).toBe(20)
        }
        expect(warn).toHaveBeenCalledTimes(4)
    })

    it('drops bad list entries and bad per-language values with one warning each', () => {
        const config = normalizeConfig({ include: ['/a/*', 3, ''], title: { en: 'Blog', de: '' } })
        expect(config.include).toEqual(['/a/*'])
        expect(config.title).toEqual({ en: 'Blog' })
        expect(messages()).toEqual([
            '⚠️ plugin-feed: config/feed.yaml: ignoring include entries that are not non-empty strings',
            '⚠️ plugin-feed: config/feed.yaml: ignoring title values that are not non-empty strings',
        ])
    })

    it('treats an empty key as absent, an empty list as empty, and warns on unknown keys', () => {
        expect(normalizeConfig({ limit: null, layouts: [], output: 'x.xml' })).toEqual({ ...defaults(), layouts: [] })
        expect(messages()).toEqual(['⚠️ plugin-feed: config/feed.yaml: ignoring unknown key "output"'])
    })

    it('warns on a non-mapping top level', () => {
        expect(normalizeConfig(['a'])).toEqual(defaults())
        expect(normalizeConfig('atom')).toEqual(defaults())
        expect(warn).toHaveBeenCalledTimes(2)
    })

    it('sends warnings to the given function instead of the console', () => {
        const seen = []
        normalizeConfig({ format: 'json' }, (message) => seen.push(message))
        expect(seen).toEqual(['config/feed.yaml: invalid format "json", using "atom"'])
        expect(warn).not.toHaveBeenCalled()
    })
})

describe('loadConfig', () => {
    it('reads the site config and works without one', () => {
        const cwd = tempDir()
        expect(loadConfig({ cwd })).toEqual(defaults())
        write(path.join(cwd, 'config/feed.yaml'), 'format: rss\n')
        expect(loadConfig({ cwd }).format).toBe('rss')
    })

    it('honours app.folders.config', () => {
        const cwd = tempDir()
        write(path.join(cwd, 'settings/feed.yaml'), 'limit: 3\n')
        expect(loadConfig({ cwd, app: { folders: { config: 'settings' } } }).limit).toBe(3)
        expect(fs.existsSync(path.join(cwd, 'config'))).toBe(false)
    })
})

describe('resolveOrigin', () => {
    it('prefers app.origin, else canonical-links app_origin, trimmed', () => {
        const cwd = tempDir()
        expect(resolveOrigin({ cwd, app: { origin: 'https://example.com/' } })).toBe('https://example.com')
        expect(resolveOrigin({ cwd, app: {} })).toBe('')
        write(path.join(cwd, 'config/canonical-links.yaml'), 'app_origin: https://example.org//\n')
        expect(resolveOrigin({ cwd, app: {} })).toBe('https://example.org')
        expect(resolveOrigin({ cwd, app: { origin: 'https://example.com' } })).toBe('https://example.com')
    })

    it('ignores a canonical-links file that is not a mapping', () => {
        const cwd = tempDir()
        write(path.join(cwd, 'config/canonical-links.yaml'), '- a\n')
        expect(resolveOrigin({ cwd, app: {} })).toBe('')
    })
})
