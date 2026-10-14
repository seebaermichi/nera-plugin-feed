import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, expect, vi } from 'vitest'
import { XMLValidator } from 'fast-xml-parser'
import run from '@nera-static/core'

export const write = (file, content) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
}

// Every dir `tempDir` creates, removed once the importing test file is done.
// After all its tests rather than after each, because suites create their
// site once in `beforeAll` and read it in several tests. `build` restores the
// cwd before returning, so no dir is removed while the process is inside it.
const created = []

afterAll(() => {
    for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

// The real path: on macOS the tmpdir sits behind the /var -> /private/var
// symlink, and process.cwd() after a chdir reports the real one, so paths
// built from both sides would disagree in `path.relative`.
export const tempDir = (prefix = 'nera-feed-') => {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)))
    created.push(dir)
    return dir
}

/**
 * Build the site at `root` with core's real `run()`, from inside `root` the
 * way `nera build` runs it. Console output is silenced; the returned array
 * holds every `console.warn` line. The cwd is restored even when the build
 * throws.
 *
 * @param {string} root the site root
 * @returns {Promise<string[]>}
 */
export async function build(root) {
    const prev = process.cwd()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
        process.chdir(root)
        await run({
            folders: {
                config: path.join(root, 'config'),
                pages: path.join(root, 'pages'),
                views: path.join(root, 'views'),
                assets: path.join(root, 'assets'),
                dist: path.join(root, 'public'),
                plugins: path.join(root, 'plugins'),
            },
        })
        return warn.mock.calls.map((call) => call.join(' '))
    } finally {
        process.chdir(prev)
        log.mockRestore()
        warn.mockRestore()
    }
}

// What fast-xml-parser's validator lets through but XML 1.0 forbids: a
// character outside the Char production, and an entity reference other
// than the five predefined ones or a numeric one.
const XML_INVALID_CHAR = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/
const UNDEFINED_ENTITY = /&(?!(?:amp|lt|gt|apos|quot|#\d+|#x[0-9A-Fa-f]+);)/

/**
 * Fail the test unless `xml` is a well-formed XML document (ROADMAP slice 3):
 * fast-xml-parser's validator, plus the two checks above.
 *
 * @param {string} xml
 */
export function expectWellFormed(xml) {
    expect(XMLValidator.validate(xml)).toBe(true)
    expect(xml).not.toMatch(XML_INVALID_CHAR)
    expect(xml).not.toMatch(UNDEFINED_ENTITY)
}
