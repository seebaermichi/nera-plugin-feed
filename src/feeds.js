// From entries to feed files and links (ROADMAP D5, D7–D9): output paths
// per language and format, feed titles and authors, entry view models, and
// the `app.feeds` links. Pure: the hooks pass the normalized config, the
// resolved origin and core's `app`/`pagesData`.

import { ATOM_TYPE, buildAtom } from './atom.js'
import { absolutizeContent } from './content.js'
import { FORMATS } from './config.js'
import { RSS_TYPE, buildRss } from './rss.js'
import { joinUrl } from './urls.js'

const FILES = {
    atom: { file: 'feed.xml', type: ATOM_TYPE, build: buildAtom },
    rss: { file: 'rss.xml', type: RSS_TYPE, build: buildRss },
}

const nonEmptyString = (value) => typeof value === 'string' && value.trim() !== ''

/**
 * A feed's path relative to `public/` (D5): `feed.xml`/`rss.xml` for the
 * default language, `<lang>/feed.xml`/`<lang>/rss.xml` for the others.
 */
export function feedPath(lang, defaultLang, format) {
    const file = FILES[format].file
    return lang === defaultLang ? file : `${lang}/${file}`
}

/**
 * The logical href of a language's home page (D8): its index page when that
 * is rendered (`/index.html`, `/de/index.html`), else its folder (`/`,
 * `/de/`).
 */
export function homeHref(lang, defaultLang, pagesData = []) {
    const folder = lang === defaultLang ? '/' : `/${lang}/`
    const index = `${folder}index.html`
    const rendered = pagesData.some((page) => page?.meta?.layout && page.meta.href === index)
    return rendered ? index : folder
}

// A `title`/`subtitle` config value for `lang`: the string itself, or the
// mapping's value for that language.
const forLanguage = (value, lang) =>
    typeof value === 'string' ? value : (value && value[lang]) || null

/** The feed title (D8): config `title`, else `app.name`, else the origin's host. */
export function feedTitle({ config, app, lang, origin }) {
    const own = forLanguage(config.title, lang)
    if (own) return own
    if (nonEmptyString(app?.name)) return app.name.trim()
    return origin.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
}

/**
 * The feed subtitle (D8): config `subtitle`, else the language's
 * `app_description` translation, else null.
 */
export function feedSubtitle({ config, app, lang }) {
    const own = forLanguage(config.subtitle, lang)
    if (own) return own
    const translated = app?.translations?.[lang]?.app_description
    return nonEmptyString(translated) ? translated.trim() : null
}

/** The feed author (D8): config `author`, else `app.name`, else the title. */
export function feedAuthor({ config, app, title }) {
    if (config.author) return config.author
    return nonEmptyString(app?.name) ? app.name.trim() : title
}

/**
 * A page's tags as categories (D8): a list of strings or a comma-separated
 * string, trimmed, empty values and duplicates dropped, in the order written.
 */
export function entryTags(meta) {
    const raw = typeof meta.tags === 'string' ? meta.tags.split(',') : meta.tags
    if (!Array.isArray(raw)) return []
    const tags = raw.filter((tag) => typeof tag === 'string').map((tag) => tag.trim())
    return [...new Set(tags.filter((tag) => tag !== ''))]
}

const trimmedOrNull = (value) => (nonEmptyString(value) ? value.trim() : null)

/**
 * The view model of one entry for the serializers (D7, D8): absolute URL,
 * title, dates, author, tags, the summary (`description`, else `lead`) and
 * the HTML with absolute URLs (null with `content: summary`).
 */
export function entryView(entry, { origin, basePath, content }) {
    const { meta, href } = entry
    return {
        url: joinUrl(origin, basePath, href),
        title: trimmedOrNull(meta.title) || href,
        published: entry.published,
        updated: entry.updated,
        author: trimmedOrNull(meta.author),
        tags: entryTags(meta),
        summary: trimmedOrNull(meta.description) || trimmedOrNull(meta.lead),
        html: content === 'summary' ? null : absolutizeContent(entry.content, { origin, basePath, href }),
    }
}

/**
 * `app.feeds` (D9): language → the feeds of that language, each `{ format,
 * type, href, url, title }`, Atom before RSS. `href` is root-relative with
 * base_path (core's HTML rewrite leaves such a value alone), `url` absolute.
 *
 * @param {{ languages: string[], defaultLang: string, config: object, app: object,
 *   origin: string }} options
 * @returns {Record<string, Array<{ format: string, type: string, href: string,
 *   url: string, title: string }>>}
 */
export function feedLinks({ languages, defaultLang, config, app, origin }) {
    const basePath = app?.basePath || ''
    const links = {}
    for (const lang of languages) {
        const title = feedTitle({ config, app, lang, origin })
        links[lang] = FORMATS[config.format].map((format) => {
            const href = `/${feedPath(lang, defaultLang, format)}`
            return {
                format,
                type: FILES[format].type,
                href: `${basePath}${href}`,
                url: joinUrl(origin, basePath, href),
                title,
            }
        })
    }
    return links
}

/**
 * Every feed file of the site: `[{ to, xml }]`, per language (in the order
 * of `groups`) and format (Atom first), `to` relative to `public/`.
 *
 * @param {{ groups: Map<string, object[]>, defaultLang: string, pagesData: object[],
 *   config: object, app: object, origin: string }} options
 * @returns {Array<{ to: string, xml: string }>}
 */
export function buildFeeds({ groups, defaultLang, pagesData, config, app, origin }) {
    const basePath = app?.basePath || ''
    const files = []
    for (const [lang, entries] of groups) {
        const title = feedTitle({ config, app, lang, origin })
        const views = entries.map((entry) => entryView(entry, { origin, basePath, content: config.content }))
        for (const format of FORMATS[config.format]) {
            const to = feedPath(lang, defaultLang, format)
            const xml = FILES[format].build({
                lang,
                title,
                subtitle: feedSubtitle({ config, app, lang }),
                author: feedAuthor({ config, app, title }),
                selfUrl: joinUrl(origin, basePath, `/${to}`),
                homeUrl: joinUrl(origin, basePath, homeHref(lang, defaultLang, pagesData)),
                entries: views,
            })
            files.push({ to, xml })
        }
    }
    return files
}
