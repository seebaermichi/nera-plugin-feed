// URL and XML helpers for the feeds (ROADMAP D2, D3, D7), taken from
// plugin-sitemap's `src/urls.js`: origin trimming, the origin + basePath +
// href join with percent-encoding, XML escaping and href pattern matching.

// A percent-escape that is already valid: `%` and two hex digits. The
// capture group keeps it in `split`'s output, at the odd indexes.
const PERCENT_ESCAPE = /(%[0-9A-Fa-f]{2})/

const XML_ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '\'': '&apos;',
    '"': '&quot;',
}

// Characters XML 1.0 does not allow anywhere in a document, not even
// escaped: C0 controls other than tab, LF and CR, lone surrogates, and
// U+FFFE/U+FFFF (D7).
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

/**
 * The site origin without trailing slashes, or '' when it is not a
 * non-empty string (the caller then warns and writes no feed).
 */
export function trimOrigin(origin) {
    if (typeof origin !== 'string') return ''
    return origin.trim().replace(/\/+$/, '')
}

/**
 * Percent-encodes what a URL may not contain (space, non-ASCII, a `%` not
 * starting a valid escape, …) and leaves valid `%XX` escapes and URL
 * delimiters untouched, so an already-encoded path is not encoded twice.
 * Lone surrogates become U+FFFD instead of making `encodeURI` throw.
 */
export function encodePath(value) {
    return value
        .toWellFormed()
        .split(PERCENT_ESCAPE)
        .map((part, index) => (index % 2 ? part : encodeURI(part)))
        .join('')
}

/**
 * The absolute URL of a page or feed: origin + basePath + the logical
 * `href`, percent-encoded (see `encodePath`) but otherwise verbatim
 * (`/index.html` stays as is, so it matches the site's own links).
 * `basePath` is core's normalized `app.basePath` ('' or '/sub'); the origin
 * is used as given.
 */
export function joinUrl(origin, basePath, href) {
    return `${origin}${encodePath(`${basePath || ''}${href}`)}`
}

/**
 * Escapes the five XML special characters and drops the characters XML 1.0
 * forbids, so any page text yields a well-formed feed.
 */
export function escapeXml(value) {
    return String(value)
        .replace(XML_INVALID, '')
        .replace(/[&<>'"]/g, (char) => XML_ENTITIES[char])
}

/**
 * Whether `href` matches a pattern: `*` matches any run of characters
 * (including `/`), everything else is literal, anchored at both ends.
 */
export function matchesPattern(href, pattern) {
    const source = pattern
        .split('*')
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*')
    return new RegExp(`^${source}$`).test(href)
}

/** Whether `href` matches any of the `patterns`. */
export function matchesAny(href, patterns = []) {
    return patterns.some((pattern) => matchesPattern(href, pattern))
}
