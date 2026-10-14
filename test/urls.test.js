import { describe, expect, it } from 'vitest'
import { encodePath, escapeXml, joinUrl, matchesAny, matchesPattern, trimOrigin } from '../src/urls.js'

describe('trimOrigin', () => {
    it('drops trailing slashes and surrounding whitespace', () => {
        expect(trimOrigin('https://example.com/')).toBe('https://example.com')
        expect(trimOrigin(' https://example.com// ')).toBe('https://example.com')
    })

    it('returns an empty string for a missing or non-string origin', () => {
        expect(trimOrigin(undefined)).toBe('')
        expect(trimOrigin(42)).toBe('')
        expect(trimOrigin('/')).toBe('')
    })
})

describe('joinUrl', () => {
    it('joins origin, basePath and href', () => {
        expect(joinUrl('https://example.com', '', '/blog/a.html')).toBe('https://example.com/blog/a.html')
        expect(joinUrl('https://example.com', undefined, '/feed.xml')).toBe('https://example.com/feed.xml')
        expect(joinUrl('https://example.com', '/sub', '/de/feed.xml')).toBe('https://example.com/sub/de/feed.xml')
    })

    it('percent-encodes basePath and href, never twice', () => {
        expect(joinUrl('https://example.com', '/my docs', '/über uns.html')).toBe('https://example.com/my%20docs/%C3%BCber%20uns.html')
        expect(joinUrl('https://example.com', '', '/about%20us.html')).toBe('https://example.com/about%20us.html')
    })
})

describe('encodePath', () => {
    it('encodes a % that does not start a valid escape and keeps delimiters', () => {
        expect(encodePath('/100%.html')).toBe('/100%25.html')
        expect(encodePath('/a.html?x=1&y=2#top')).toBe('/a.html?x=1&y=2#top')
    })

    it('replaces a lone surrogate instead of throwing', () => {
        expect(encodePath('/\uD800.html')).toBe('/%EF%BF%BD.html')
    })
})

describe('escapeXml', () => {
    it('escapes all five XML special characters', () => {
        expect(escapeXml('a&b<c>d\'e"f')).toBe('a&amp;b&lt;c&gt;d&apos;e&quot;f')
    })

    it('escapes an existing entity again rather than trusting it', () => {
        expect(escapeXml('&amp;')).toBe('&amp;amp;')
    })

    it('drops characters XML 1.0 forbids and keeps tab, newline and astral characters', () => {
        const forbidden = ['\u0000', '\u0001', '\u000B', '\u001F', String.fromCharCode(0xFFFE), String.fromCharCode(0xFFFF)]
        expect(escapeXml(`a${forbidden.join('')}b`)).toBe('ab')
        expect(escapeXml('a\tb\nc\rd')).toBe('a\tb\nc\rd')
        expect(escapeXml('😀')).toBe('😀')
        expect(escapeXml('a\uD800b\uDC00c')).toBe('abc')
    })

    it('stringifies non-strings', () => {
        expect(escapeXml(42)).toBe('42')
    })
})

describe('matchesPattern / matchesAny', () => {
    it('matches literally and anchored at both ends', () => {
        expect(matchesPattern('/blog/a.html', '/blog/a.html')).toBe(true)
        expect(matchesPattern('/de/blog/a.html', '/blog/a.html')).toBe(false)
    })

    it('lets * match any run of characters, including /', () => {
        expect(matchesPattern('/blog/2026/a.html', '/blog/*')).toBe(true)
        expect(matchesPattern('/de/notes/x.html', '*/notes/*')).toBe(true)
        expect(matchesPattern('/blog.html', '/blog/*')).toBe(false)
    })

    it('treats regex characters literally', () => {
        expect(matchesPattern('/a+b.html', '/a+b.html')).toBe(true)
        expect(matchesPattern('/aab.html', '/a+b.html')).toBe(false)
    })

    it('matches any of a list', () => {
        expect(matchesAny('/x.html', ['/y.html', '/x.*'])).toBe(true)
        expect(matchesAny('/x.html', [])).toBe(false)
        expect(matchesAny('/x.html')).toBe(false)
    })
})
