import path from 'path'
import { getConfig } from '@nera-static/plugin-utils'
import { trimOrigin } from './urls.js'
import { warn as consoleWarn } from './warn.js'

// `config/feed.yaml` is optional and every key has a default (ROADMAP D10
// and "Configuration"). `getConfig` returns `{}` for a missing file, so each
// key gets its own JS fallback here. A key with a bad value warns and falls
// back to its default rather than failing the build.

/** The values of `format`, and the feed formats each one writes (D6). */
export const FORMATS = {
    atom: ['atom'],
    rss: ['rss'],
    both: ['atom', 'rss'],
}

const CONTENT_MODES = ['full', 'summary']

export function defaults() {
    return {
        format: 'atom',
        layouts: ['pages/post.pug'],
        include: [],
        exclude: [],
        limit: 20,
        content: 'full',
        title: null,
        subtitle: null,
        author: null,
    }
}

const isPlainObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)

const nonEmptyString = (value) => typeof value === 'string' && value.trim() !== ''

const show = (value) => JSON.stringify(value)

// A list of non-empty strings; a single string is a one-item list.
const readList = (key) => (value, fallback, warn) => {
    const list = typeof value === 'string' ? [value] : value
    if (!Array.isArray(list)) return bad(warn, key, value, fallback)
    const items = list.filter(nonEmptyString).map((item) => item.trim())
    if (items.length !== list.length) {
        warn(`config/feed.yaml: ignoring ${key} entries that are not non-empty strings`)
    }
    return items
}

const readChoice = (key, choices) => (value, fallback, warn) =>
    choices.includes(value) ? value : bad(warn, key, value, fallback)

const readLimit = (value, fallback, warn) =>
    Number.isInteger(value) && value >= 1 ? value : bad(warn, 'limit', value, fallback)

// A string for every language, or a mapping language → string (D8). A
// mapping's bad values are dropped; nothing usable left means no override.
const readPerLanguage = (key) => (value, fallback, warn) => {
    if (nonEmptyString(value)) return value.trim()
    if (!isPlainObject(value)) return bad(warn, key, value, fallback)
    const entries = Object.entries(value).filter(([, text]) => nonEmptyString(text))
    if (entries.length !== Object.keys(value).length) {
        warn(`config/feed.yaml: ignoring ${key} values that are not non-empty strings`)
    }
    if (entries.length === 0) return fallback
    return Object.fromEntries(entries.map(([lang, text]) => [lang, text.trim()]))
}

const readString = (key) => (value, fallback, warn) =>
    nonEmptyString(value) ? value.trim() : bad(warn, key, value, fallback)

function bad(warn, key, value, fallback) {
    const using = fallback === null ? 'ignoring it' : `using ${show(fallback)}`
    warn(`config/feed.yaml: invalid ${key} ${show(value)}, ${using}`)
    return fallback
}

const readers = {
    format: readChoice('format', Object.keys(FORMATS)),
    layouts: readList('layouts'),
    include: readList('include'),
    exclude: readList('exclude'),
    limit: readLimit,
    content: readChoice('content', CONTENT_MODES),
    title: readPerLanguage('title'),
    subtitle: readPerLanguage('subtitle'),
    author: readString('author'),
}

/**
 * Merge a raw config object over the defaults, key by key, with validation.
 * Pure apart from warnings, which go to `warn` (the plugin's console warning
 * by default; `getAppData` passes a no-op so each problem is reported once,
 * by `getAssets` — D9). `normalizeConfig({})` is the full default config.
 *
 * @param {object} raw parsed `config/feed.yaml`
 * @param {(message: string) => void} [warn]
 * @returns {{ format: 'atom'|'rss'|'both', layouts: string[], include: string[],
 *   exclude: string[], limit: number, content: 'full'|'summary',
 *   title: string|object|null, subtitle: string|object|null, author: string|null }}
 */
export function normalizeConfig(raw, warn = consoleWarn) {
    const config = defaults()
    if (raw === null || raw === undefined) return config
    if (!isPlainObject(raw)) {
        warn('config/feed.yaml: expected a mapping at the top level, using defaults')
        return config
    }

    for (const [key, value] of Object.entries(raw)) {
        const read = readers[key]
        if (!read) {
            warn(`config/feed.yaml: ignoring unknown key ${show(key)}`)
            continue
        }
        // A key present but empty reads as null; treat it like an absent key.
        if (value === null) continue
        config[key] = read(value, config[key], warn)
    }
    return config
}

const configFile = (cwd, app, name) =>
    path.resolve(cwd, app?.folders?.config || 'config', name)

/**
 * Read and normalize the site's `config/feed.yaml`. Called inside the hooks,
 * not at module scope, so each build (and each test) sees the current file.
 * `app.folders.config` is honoured when set, like the rest of the pipeline.
 *
 * @param {{ cwd?: string, app?: object, warn?: (message: string) => void }} [options]
 */
export function loadConfig({ cwd = process.cwd(), app, warn } = {}) {
    return normalizeConfig(getConfig(configFile(cwd, app, 'feed.yaml')), warn)
}

/**
 * The site origin without trailing slashes (D2): `app.origin`, else
 * `app_origin` from `config/canonical-links.yaml` — plugin-sitemap's order.
 * '' when neither is set; the canonical-links file is only read when
 * `app.origin` is missing, and a missing file reads as `{}`.
 *
 * @param {{ cwd?: string, app?: object }} [options]
 */
export function resolveOrigin({ cwd = process.cwd(), app } = {}) {
    const own = trimOrigin(app?.origin)
    if (own) return own
    const canonical = getConfig(configFile(cwd, app, 'canonical-links.yaml'))
    return trimOrigin(isPlainObject(canonical) ? canonical.app_origin : undefined)
}
