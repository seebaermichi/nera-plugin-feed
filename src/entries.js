// Which pages are feed entries, grouped by language (ROADMAP D3–D5). Pure:
// page data and options in, groups and the pages that were skipped out. No
// file system, no config file, no console — the hooks pass the normalized
// config and report what this returns.

import { publishedDate, updatedDate } from './dates.js'
import { matchesAny } from './urls.js'

// A language tag as it may appear in a path segment and in `xml:lang`:
// `en`, `de`, `pt-BR`, `zh-Hant-TW` (D5).
const LANGUAGE_TAG = /^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$/

/** The language used when `config/app.yaml` sets none (D5). */
export const FALLBACK_LANG = 'en'

const nonEmptyString = (value) => typeof value === 'string' && value !== ''

/** Whether `value` can name a feed's language (D5). */
export function isLanguageTag(value) {
    return typeof value === 'string' && LANGUAGE_TAG.test(value)
}

/** The site's default language: `app.lang`, else `en` (D5). */
export function defaultLanguage(app) {
    return nonEmptyString(app?.lang) ? app.lang : FALLBACK_LANG
}

/** A page's language: `meta.lang`, else the site's default (D5). */
export function pageLanguage(meta, defaultLang) {
    return nonEmptyString(meta.lang) ? meta.lang : defaultLang
}

/**
 * Whether a page qualifies before its date and language are looked at
 * (D3): it is rendered (`layout`) with a string `href`, its layout is one
 * of `layouts` or its href matches `include`, and it is not opted out by
 * `feed: false`, a `noindex` robots value (frontmatter, else the site's
 * `robots`) or an `exclude` pattern.
 *
 * @param {object} meta the page's `meta`
 * @param {{ robots?: string, layouts?: string[], include?: string[],
 *   exclude?: string[] }} options
 */
export function isCandidate(meta, { robots, layouts = [], include = [], exclude = [] } = {}) {
    if (!meta || !meta.layout) return false
    if (!nonEmptyString(meta.href)) return false
    if (!layouts.includes(meta.layout) && !matchesAny(meta.href, include)) return false
    if (meta.feed === false) return false
    const effectiveRobots = meta.robots || robots
    if (typeof effectiveRobots === 'string' && /noindex/i.test(effectiveRobots)) return false
    return !matchesAny(meta.href, exclude)
}

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** Newest first by published date, ties by `href` (D3). */
export function compareEntries(a, b) {
    return b.published - a.published || byString(a.href, b.href)
}

/**
 * The feed entries of a site, per language (D3–D5).
 *
 * Returns `groups` — language → entries `{ href, meta, content, published,
 * updated }`, newest first, at most `limit` each, languages in string order
 * with only those that have an entry — plus the hrefs of candidates skipped
 * for a missing date (`undated`) or a language that is not a language tag
 * (`badLanguage`), each in href order, for the caller to report once.
 *
 * @param {Array<{ meta: object, content?: string }>} pagesData core's page data
 * @param {{ lang?: string, robots?: string, layouts?: string[], include?: string[],
 *   exclude?: string[], limit?: number }} options `lang` and `robots` the
 *   site's `app.lang`/`app.robots`
 * @returns {{ groups: Map<string, object[]>, undated: string[], badLanguage: string[] }}
 */
export function collectEntries(pagesData, { lang, robots, layouts, include, exclude, limit = 20 } = {}) {
    const defaultLang = defaultLanguage({ lang })
    const seen = new Set()
    const byLanguage = new Map()
    const undated = []
    const badLanguage = []

    for (const page of pagesData || []) {
        const meta = page && page.meta
        if (!isCandidate(meta, { robots, layouts, include, exclude })) continue
        if (seen.has(meta.href)) continue
        seen.add(meta.href)

        const language = pageLanguage(meta, defaultLang)
        if (!isLanguageTag(language)) {
            badLanguage.push(meta.href)
            continue
        }
        const published = publishedDate(meta)
        if (!published) {
            undated.push(meta.href)
            continue
        }
        if (!byLanguage.has(language)) byLanguage.set(language, [])
        byLanguage.get(language).push({
            href: meta.href,
            meta,
            content: typeof page.content === 'string' ? page.content : '',
            published,
            updated: updatedDate(meta, published),
        })
    }

    const groups = new Map([...byLanguage]
        .sort(([a], [b]) => byString(a, b))
        .map(([language, entries]) => [language, entries.sort(compareEntries).slice(0, limit)]))
    return { groups, undated: undated.sort(byString), badLanguage: badLanguage.sort(byString) }
}
