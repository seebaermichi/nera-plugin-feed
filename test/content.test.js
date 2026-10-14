import { describe, expect, it } from 'vitest'
import { absolutizeContent, absolutizeSrcset, absolutizeUrl } from '../src/content.js'

const origin = 'https://example.com'
const base = { origin, basePath: '', pageUrl: 'https://example.com/blog/2026/post.html' }
const sub = { origin, basePath: '/sub', pageUrl: 'https://example.com/sub/blog/2026/post.html' }

describe('absolutizeUrl', () => {
    it('prefixes a root-relative URL with origin and basePath', () => {
        expect(absolutizeUrl('/img/a.png', base)).toBe('https://example.com/img/a.png')
        expect(absolutizeUrl('/img/a.png', sub)).toBe('https://example.com/sub/img/a.png')
        expect(absolutizeUrl('/about us.html', base)).toBe('https://example.com/about%20us.html')
    })

    it('does not prefix a URL that already starts with basePath', () => {
        expect(absolutizeUrl('/sub/img/a.png', sub)).toBe('https://example.com/sub/img/a.png')
        expect(absolutizeUrl('/sub', sub)).toBe('https://example.com/sub')
        expect(absolutizeUrl('/subway.html', sub)).toBe('https://example.com/sub/subway.html')
    })

    it('resolves relative URLs against the page', () => {
        expect(absolutizeUrl('a.png', base)).toBe('https://example.com/blog/2026/a.png')
        expect(absolutizeUrl('./a.png', base)).toBe('https://example.com/blog/2026/a.png')
        expect(absolutizeUrl('../other.html#x', base)).toBe('https://example.com/blog/other.html#x')
        expect(absolutizeUrl('../../../../up.html', sub)).toBe('https://example.com/up.html')
        expect(absolutizeUrl('?page=2', base)).toBe('https://example.com/blog/2026/post.html?page=2')
    })

    it('leaves URLs with a scheme, protocol-relative URLs, fragments and empty values alone', () => {
        for (const value of ['https://other.org/x', 'http://a.b', 'mailto:me@example.com', 'tel:+49',
            'data:image/png;base64,AAAA', '//cdn.example.org/x.js', '#top', '', '  ']) {
            expect(absolutizeUrl(value, base)).toBe(value)
        }
    })
})

describe('absolutizeSrcset', () => {
    it('makes every URL absolute and keeps the descriptors', () => {
        expect(absolutizeSrcset('/a.png 1x, b.png 2x', base))
            .toBe('https://example.com/a.png 1x, https://example.com/blog/2026/b.png 2x')
        expect(absolutizeSrcset(' /a-400.webp 400w ,/a-800.webp  800w,', sub))
            .toBe('https://example.com/sub/a-400.webp 400w, https://example.com/sub/a-800.webp 800w')
    })
})

describe('absolutizeContent', () => {
    const page = { origin, basePath: '/sub', href: '/blog/post.html' }

    it('rewrites href, src, poster and srcset in both quote styles', () => {
        const html = [
            '<p><a href="/about.html">About</a> <a href=\'next.html\'>Next</a></p>',
            '<picture><source srcset="/a.webp 1x, a@2x.webp 2x"><img src="/a.png" alt=""></picture>',
            '<video poster="poster.jpg" src=\'/v.mp4\'></video>',
        ].join('\n')
        expect(absolutizeContent(html, page)).toBe([
            '<p><a href="https://example.com/sub/about.html">About</a> <a href=\'https://example.com/sub/blog/next.html\'>Next</a></p>',
            '<picture><source srcset="https://example.com/sub/a.webp 1x, https://example.com/sub/blog/a@2x.webp 2x"><img src="https://example.com/sub/a.png" alt=""></picture>',
            '<video poster="https://example.com/sub/blog/poster.jpg" src=\'https://example.com/sub/v.mp4\'></video>',
        ].join('\n'))
    })

    it('handles a value holding the other quote', () => {
        expect(absolutizeContent('<a href="it\'s.html">x</a>', page))
            .toBe('<a href="https://example.com/sub/blog/it\'s.html">x</a>')
    })

    it('leaves escaped markup (markdown-it writes text quotes as &quot;) and other attributes alone', () => {
        const html = '<p>Use href=&quot;/x&quot;</p><pre><code>&lt;a href=&quot;/x&quot;&gt;</code></pre><a title="/x" href="#top">t</a>'
        expect(absolutizeContent(html, page)).toBe(html)
    })

    it('copes with empty or missing content', () => {
        expect(absolutizeContent('', page)).toBe('')
    })
})
