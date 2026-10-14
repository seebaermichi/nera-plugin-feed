// Entry content with absolute URLs (ROADMAP D7). A feed is read outside the
// site, so a `/img/a.png` or `../b.html` in a post would resolve against the
// feed reader, not the site. Core's own base_path rewrite only runs on the
// rendered page, never on `pageData.content`, so the plugin applies origin
// and basePath itself.

import { encodePath, joinUrl } from './urls.js'

// A value with a scheme (`https:`, `mailto:`, `data:`, …).
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

// `href`, `src` and `poster` in a double- or single-quoted attribute; the
// same attributes core's rewriteHtmlUrls prefixes with base_path.
// The value may hold the other quote (`href="it's.html"`).
const URL_ATTRIBUTE = /\b(href|src|poster)=(?:"([^"]*)"|'([^']*)')/gi

const SRCSET_ATTRIBUTE = /\bsrcset=(?:"([^"]*)"|'([^']*)')/gi

// The attribute rewritten with `value` in the quotes it had.
const quoted = (name, double, single, rewrite) =>
    double === undefined ? `${name}='${rewrite(single)}'` : `${name}="${rewrite(double)}"`

/**
 * One URL from a page's content, made absolute (D7):
 *
 * - root-relative `/x` → origin + basePath + `/x`, percent-encoded, unless it
 *   already starts with `basePath/` (then origin + `/x`), as core's rewrite
 *   skips prefixed values;
 * - relative `x`, `./x`, `../x`, `?q` → resolved against `pageUrl`;
 * - anything with a scheme, protocol-relative `//…`, a fragment `#…` or an
 *   empty value → unchanged, as is a value `URL` cannot parse.
 *
 * @param {string} value the attribute value, as written
 * @param {{ origin: string, basePath?: string, pageUrl: string }} base
 */
export function absolutizeUrl(value, { origin, basePath = '', pageUrl }) {
    const url = value.trim()
    if (url === '' || url.startsWith('#') || url.startsWith('//') || HAS_SCHEME.test(url)) {
        return value
    }
    if (url.startsWith('/')) {
        const prefixed = basePath && (url === basePath || url.startsWith(`${basePath}/`))
        return prefixed ? `${origin}${encodePath(url)}` : joinUrl(origin, basePath, url)
    }
    try {
        return new URL(url, pageUrl).href
    } catch {
        return value
    }
}

/**
 * Every URL in `srcset` (comma-separated `url descriptor` pairs) made
 * absolute, the descriptors kept: `a.png 1x, /b.png 2x`.
 */
export function absolutizeSrcset(list, base) {
    return list
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '')
        .map((part) => {
            const [url, ...descriptor] = part.split(/\s+/)
            return [absolutizeUrl(url, base), ...descriptor].join(' ')
        })
        .join(', ')
}

/**
 * The page's HTML with the values of `href`, `src`, `poster` and `srcset`
 * made absolute against the page's own URL (`origin + basePath + href`).
 *
 * @param {string} html the page's rendered content
 * @param {{ origin: string, basePath?: string, href: string }} page
 */
export function absolutizeContent(html, { origin, basePath = '', href }) {
    const base = { origin, basePath, pageUrl: joinUrl(origin, basePath, href) }
    return String(html)
        .replace(URL_ATTRIBUTE, (match, attribute, double, single) =>
            quoted(attribute, double, single, (value) => absolutizeUrl(value, base)))
        .replace(SRCSET_ATTRIBUTE, (match, double, single) =>
            quoted('srcset', double, single, (list) => absolutizeSrcset(list, base)))
}
