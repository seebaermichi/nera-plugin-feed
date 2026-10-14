import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pug from 'pug'
import { describe, expect, it } from 'vitest'
import { tempDir, write } from './helpers.js'

// The `<link rel="alternate">` partial (ROADMAP D9 / slice 5), rendered with
// pug the way core renders a layout that includes it, and published with
// the package's `bin/publish-template.js`.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const partial = path.join(root, 'views/feed-link.pug')

// Rendered inside a `doctype html` layout's head, as a site uses it (pug
// writes void elements as `<link …>` only under the HTML doctype); returns
// the head's content.
const LAYOUT = 'doctype html\nhtml\n  head\n    include feed-link\n'
const render = (locals) => pug
    .render(LAYOUT, { filename: path.join(root, 'views/layout.pug'), ...locals })
    .replace(/^<!DOCTYPE html><html><head>(.*)<\/head><\/html>$/, '$1')

const feeds = {
    en: [
        { format: 'atom', type: 'application/atom+xml', href: '/feed.xml', url: 'https://example.com/feed.xml', title: 'Demo' },
        { format: 'rss', type: 'application/rss+xml', href: '/rss.xml', url: 'https://example.com/rss.xml', title: 'Demo' },
    ],
    de: [
        { format: 'atom', type: 'application/atom+xml', href: '/de/feed.xml', url: 'https://example.com/de/feed.xml', title: 'Demo "DE" & Co' },
    ],
}

describe('views/feed-link.pug', () => {
    it('links the feeds of the page\'s language', () => {
        expect(render({ app: { lang: 'en', feeds }, meta: { lang: 'de' } })).toBe(
            '<link rel="alternate" type="application/atom+xml" href="/de/feed.xml" title="Demo &quot;DE&quot; &amp; Co">'
        )
    })

    it('falls back to the site language, then en', () => {
        const both = '<link rel="alternate" type="application/atom+xml" href="/feed.xml" title="Demo">' +
            '<link rel="alternate" type="application/rss+xml" href="/rss.xml" title="Demo">'
        expect(render({ app: { lang: 'en', feeds }, meta: {} })).toBe(both)
        expect(render({ app: { feeds }, meta: {} })).toBe(both)
    })

    it('renders nothing for a language without a feed, or without app.feeds', () => {
        expect(render({ app: { lang: 'en', feeds }, meta: { lang: 'fr' } })).toBe('')
        expect(render({ app: { lang: 'en' }, meta: {} })).toBe('')
    })
})

describe('bin/publish-template.js', () => {
    const publish = (cwd, ...args) => execFileSync(process.execPath, [path.join(root, 'bin/publish-template.js'), ...args], {
        cwd,
        encoding: 'utf-8',
    })

    it('copies the partial to views/vendor/plugin-feed/ and keeps an edited copy', () => {
        const site = tempDir()
        write(path.join(site, 'package.json'), '{"name":"site"}')
        write(path.join(site, 'config/app.yaml'), 'lang: en\n')
        fs.mkdirSync(path.join(site, 'pages'))

        publish(site)
        const published = path.join(site, 'views/vendor/plugin-feed/feed-link.pug')
        expect(fs.readFileSync(published, 'utf-8')).toBe(fs.readFileSync(partial, 'utf-8'))

        fs.writeFileSync(published, '//- mine\n')
        publish(site)
        expect(fs.readFileSync(published, 'utf-8')).toBe('//- mine\n')
        publish(site, '--force')
        expect(fs.readFileSync(published, 'utf-8')).toBe(fs.readFileSync(partial, 'utf-8'))
    })
})
