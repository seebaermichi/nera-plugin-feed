// Entry dates (ROADMAP D4): only from authored frontmatter, never from
// `createdAt` (core fills it from the file's birth time when the frontmatter
// has none, and CI stamps every file the same). Formatted as RFC 3339 for
// Atom and RFC 822 for RSS 2.0, both in UTC, so output does not depend on
// the build machine's time zone.

// `YYYY-MM-DD`, optionally `T` or a space, `hh:mm`, optional `:ss` and
// fraction, and an optional `Z` or `±hh:mm` offset.
const DATE_STRING = new RegExp(
    '^(\\d{4}-\\d{2}-\\d{2})' +
    '(?:[T ](\\d{2}:\\d{2})(:\\d{2}(?:\\.\\d+)?)?\\s*(Z|[+-]\\d{2}:\\d{2})?)?$'
)

/** Frontmatter keys tried for the published date, in order. */
export const PUBLISHED_KEYS = ['date', 'published']

/** Frontmatter keys tried for the updated date, in order. */
export const UPDATED_KEYS = ['updated', 'lastmod', 'updatedAt']

const validDate = (date) => (Number.isNaN(date.getTime()) ? null : date)

/**
 * A frontmatter value as a `Date`, or null when it is not a usable date: a
 * valid `Date` (YAML's unquoted dates), or a string matching `DATE_STRING`.
 * A string without an offset is read as UTC, as YAML reads unquoted values.
 * A calendar date that does not exist (`2026-02-30`) is not usable.
 */
export function toDate(value) {
    if (value instanceof Date) return validDate(value)
    if (typeof value !== 'string') return null
    const match = DATE_STRING.exec(value.trim())
    if (!match) return null
    const [, day, time = '00:00', seconds = ':00', zone = 'Z'] = match
    const date = validDate(new Date(`${day}T${time}${seconds}${zone}`))
    if (!date) return null
    // `Date` rolls an impossible day over into the next month; refuse it.
    const midnight = new Date(`${day}T00:00:00Z`)
    return midnight.toISOString().slice(0, 10) === day ? date : null
}

const firstDate = (meta, keys) => {
    for (const key of keys) {
        const date = toDate(meta[key])
        if (date) return date
    }
    return null
}

/** The published date: `date`, else `published`; null without either. */
export function publishedDate(meta) {
    return firstDate(meta, PUBLISHED_KEYS)
}

/**
 * The updated date: `updated`, else `lastmod`, else `updatedAt`, else
 * `published` (the page's published date). An updated date before the
 * published one is a typo, not an edit, so `published` wins then.
 */
export function updatedDate(meta, published) {
    const updated = firstDate(meta, UPDATED_KEYS)
    return updated && updated > published ? updated : published
}

/** RFC 3339 in UTC without milliseconds: `2026-10-01T09:30:00Z`. */
export function rfc3339(date) {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** RFC 822 (as RFC 1123 writes it): `Thu, 01 Oct 2026 09:30:00 GMT`. */
export function rfc822(date) {
    return date.toUTCString()
}
