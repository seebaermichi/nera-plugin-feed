import { describe, expect, it } from 'vitest'
import { publishedDate, rfc3339, rfc822, toDate, updatedDate } from '../src/dates.js'

const iso = (date) => date && date.toISOString()

describe('toDate', () => {
    it('keeps a valid Date (YAML\'s unquoted dates)', () => {
        const date = new Date('2026-10-01T00:00:00Z')
        expect(toDate(date)).toBe(date)
        expect(toDate(new Date('nope'))).toBeNull()
    })

    it('reads date strings, as UTC without an offset', () => {
        expect(iso(toDate('2026-10-01'))).toBe('2026-10-01T00:00:00.000Z')
        expect(iso(toDate('2026-10-01T09:30'))).toBe('2026-10-01T09:30:00.000Z')
        expect(iso(toDate('2026-10-01 09:30:15'))).toBe('2026-10-01T09:30:15.000Z')
        expect(iso(toDate('2026-10-01T09:30:15.5Z'))).toBe('2026-10-01T09:30:15.500Z')
        expect(iso(toDate('2026-10-01T11:30:00+02:00'))).toBe('2026-10-01T09:30:00.000Z')
        expect(iso(toDate(' 2026-10-01 '))).toBe('2026-10-01T00:00:00.000Z')
    })

    it('refuses anything else', () => {
        for (const value of ['2026-10', '01.10.2026', 'yesterday', '2026-02-30', '2026-13-01',
            '2026-10-01T25:00', '', 20261001, null, undefined, true, {}]) {
            expect(toDate(value)).toBeNull()
        }
    })
})

describe('publishedDate', () => {
    it('takes date, else published, and never createdAt', () => {
        expect(iso(publishedDate({ date: '2026-10-01', published: '2026-09-01' }))).toBe('2026-10-01T00:00:00.000Z')
        expect(iso(publishedDate({ date: 'soon', published: '2026-09-01' }))).toBe('2026-09-01T00:00:00.000Z')
        expect(publishedDate({ createdAt: new Date('2026-10-01T00:00:00Z') })).toBeNull()
    })
})

describe('updatedDate', () => {
    const published = new Date('2026-10-01T00:00:00Z')

    it('takes updated, else lastmod, else updatedAt, else the published date', () => {
        expect(iso(updatedDate({ updated: '2026-10-05', lastmod: '2026-10-04' }, published))).toBe('2026-10-05T00:00:00.000Z')
        expect(iso(updatedDate({ updated: 'later', lastmod: '2026-10-04' }, published))).toBe('2026-10-04T00:00:00.000Z')
        expect(iso(updatedDate({ updatedAt: '2026-10-03' }, published))).toBe('2026-10-03T00:00:00.000Z')
        expect(updatedDate({}, published)).toBe(published)
    })

    it('never goes before the published date', () => {
        expect(updatedDate({ updated: '2026-09-01' }, published)).toBe(published)
    })
})

describe('formatting', () => {
    const date = new Date('2026-10-01T09:30:15.250Z')

    it('writes RFC 3339 in UTC without milliseconds', () => {
        expect(rfc3339(date)).toBe('2026-10-01T09:30:15Z')
    })

    it('writes RFC 822 in GMT', () => {
        expect(rfc822(date)).toBe('Thu, 01 Oct 2026 09:30:15 GMT')
    })
})
