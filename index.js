// @nera-static/plugin-feed — an Atom (or RSS 2.0) feed per language.
//
// `getAppData` guards the core version (core < 4.13.0 never calls
// `getAssets`, so the build would exit 0 without a feed) and writes
// `app.feeds`, the links the `feed-link.pug` partial renders. `getAssets`
// sees the final pagesData, writes each language's feed to
// `.nera-cache/feed/` and hands the files to core to copy into `public/`.
// See ROADMAP.md for the decisions (D1–D10) behind each step.
import fs from 'fs'
import path from 'path'
import { loadConfig, resolveOrigin } from './src/config.js'
import { collectEntries, defaultLanguage } from './src/entries.js'
import { buildFeeds, feedLinks } from './src/feeds.js'
import { assertCoreVersion, coreVersion } from './src/guard.js'
import { warn } from './src/warn.js'

/** The plugin's cache folder, relative to the site root (D1). */
export const CACHE_DIR = path.join('.nera-cache', 'feed')

const collect = (pagesData, app, config) => collectEntries(pagesData, {
    lang: app.lang,
    robots: app.robots,
    layouts: config.layouts,
    include: config.include,
    exclude: config.exclude,
    limit: config.limit,
})

export function getAppData({ app = {}, pagesData = [] } = {}) {
    const cwd = process.cwd()
    assertCoreVersion(coreVersion(cwd))
    // Silent here: `getAssets` reads the same config and reports each
    // problem once (D9).
    const config = loadConfig({ cwd, app, warn: () => {} })
    const origin = resolveOrigin({ cwd, app })
    if (!origin) return { ...app, feeds: {} }

    const { groups } = collect(pagesData, app, config)
    const feeds = feedLinks({
        languages: [...groups.keys()],
        defaultLang: defaultLanguage(app),
        config,
        app,
        origin,
    })
    return { ...app, feeds }
}

// Languages `app.feeds` links but `getAssets` writes no feed for, and the
// other way round (D9): a plugin ordered after this one added or removed
// posts after `getAppData` ran.
function reportMismatch(linked, written) {
    const missing = linked.filter((lang) => !written.includes(lang))
    const unlinked = written.filter((lang) => !linked.includes(lang))
    const fix = 'A plugin running after plugin-feed changed the posts; list ' +
        'plugin-feed under `end:` in config/plugin-order.yaml.'
    if (missing.length > 0) {
        warn(`pages link a feed for ${missing.join(', ')}, but it has no entries, so no feed was written. ${fix}`)
    }
    if (unlinked.length > 0) {
        warn(`a feed was written for ${unlinked.join(', ')}, but no page links it. ${fix}`)
    }
}

export function getAssets({ app = {}, pagesData = [] } = {}) {
    const cwd = process.cwd()
    const config = loadConfig({ cwd, app })
    const origin = resolveOrigin({ cwd, app })
    if (!origin) {
        warn(
            'no site origin, so no feed was written. Set `origin` in ' +
                'config/app.yaml (or `app_origin` in config/canonical-links.yaml).'
        )
        return []
    }

    const { groups, undated, badLanguage } = collect(pagesData, app, config)
    if (undated.length > 0) {
        warn(
            `left out of the feed, because they have no valid date: ${undated.join(', ')}. ` +
                'Set `date:` in their frontmatter (e.g. `date: 2026-10-14`).'
        )
    }
    if (badLanguage.length > 0) {
        warn(
            'left out of the feed, because their language is not a language tag such as ' +
                `en or pt-BR: ${badLanguage.join(', ')}. Fix \`lang\` in their frontmatter or config/app.yaml.`
        )
    }
    if (groups.size === 0 && undated.length === 0 && badLanguage.length === 0) {
        warn(
            'no page is a feed entry, so no feed was written. Entries are pages whose layout is one of ' +
                `${config.layouts.map((layout) => `"${layout}"`).join(', ') || '(none)'}; ` +
                'set `layouts` (or `include`) in config/feed.yaml to match your posts.'
        )
    }
    if (app.feeds && typeof app.feeds === 'object') {
        reportMismatch(Object.keys(app.feeds), [...groups.keys()])
    }

    // Start from an empty cache, so a feed a language no longer has cannot
    // linger there.
    const cacheDir = path.resolve(cwd, CACHE_DIR)
    fs.rmSync(cacheDir, { recursive: true, force: true })
    const files = buildFeeds({
        groups,
        defaultLang: defaultLanguage(app),
        pagesData,
        config,
        app,
        origin,
    })
    return files.map(({ to, xml }) => {
        const from = path.resolve(cacheDir, to)
        fs.mkdirSync(path.dirname(from), { recursive: true })
        fs.writeFileSync(from, xml)
        return { from, to }
    })
}
