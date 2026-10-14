# Work log — 01a1260d-904a-70a2-a284-b3a8b28df73a-nera-plugin-feed-rss-atom-feed-plugin-per-language

- **Issue:** `01a1260d-904a-70a2-a284-b3a8b28df73a`

## Issue snapshot (2026-10-14)

- **Id:** `01a1260d-904a-70a2-a284-b3a8b28df73a`
- **Type:** feature
- **Group:** Parallel: themes and plugins
- **Status:** in_progress
- **Title:** [nera-plugin-feed] RSS/Atom feed plugin, per language

Spec: `nera-cli/ROADMAP-ai.md` — L8.

New repo with its own ROADMAP; same catalog rule.

## Cloud launch (2026-10-14)

- **Worked in a Claude Code cloud session**, outside the local plan → implement → review → approve loop (to use the cloud credit). The gate was not armed.
- **Brief:** `plans/cloud/01a1260d-904a-70a2-a284-b3a8b28df73a-brief.md` · **Branch:** `issue/01a1260d-feed-plugin` · **Session:** launched by the user (`! claude --cloud`), URL to be recorded
- **Design answers (2026-10-14):** Atom default, RSS opt-in (`rss.xml`); entries by `layouts` like theme-blog; full HTML + summary; `/feed.xml` + `/<lang>/feed.xml`.
- **On return:** `/work-issue-cloud 01a1260d-904a-70a2-a284-b3a8b28df73a` — verify locally, triage, merge, reconcile, resolve.

## Cloud result (2026-10-14)

- **Branch:** `issue/01a1260d-feed-plugin` · 16 commits · result file `plans/cloud/01a1260d-904a-70a2-a284-b3a8b28df73a-result.md` · `origin/main` unmoved (`6301aa7`)
- **Summary:** New package `@nera-static/plugin-feed` 1.0.0 in the shape of plugin-sitemap: `getAssets` writes one Atom feed per language (`feed.xml`, `<lang>/feed.xml`; RSS 2.0 `rss.xml` with `format: rss|both`) via `.nera-cache/feed/`; `getAppData` guards core ≥ 4.13.0 and writes `app.feeds`, rendered by `views/feed-link.pug` (`npx nera-feed`). ROADMAP D1–D10 + slices 1–7 with release handover and catalog snippets; README, CHANGELOG, fleet CI; 110 tests.
- **Verified locally:** `npm ci` + `npm run lint` + `npx vitest run` on Node 22.22.0 → clean, 110/110; vitest on Node 20.20.0 → 110/110; `npm pack --dry-run` → 18 files, only what ships.
- **Verified locally:** scratch site through core `run()` (`base_path: /sub`, `format: both`, en + de, `&`/`<`/quotes in title, query string, relative img, srcset) → 4 feeds, `xmllint` ok, every URL prefixed once, `<link rel="alternate">` hrefs `/sub/feed.xml`/`/sub/rss.xml`.
- **Verified locally:** W3C Feed Validator (the cloud could not reach it) → all 4 feeds valid, 0 errors; warnings: `SelfDoesntMatchLocation` (expected for rawdata) and, in RSS only, `CharacterData` on an item `<title>` holding `&`/`<`.
- **Verified locally:** carry-forward claims — `nopt@10.0.1` via core's `js-beautify@2.0.3` declares Node `^22.22.2…` (true, but already documented as accepted in core 4.16.2's CHANGELOG); `./bin/…` in `bin` is in 18 fleet packages, not only plugin-tags.
- **Review findings:** `src/rss.js` — plain-text elements (`title`, `category`, `dc:creator`, channel `title`/`description`) escape `&`/`<` as `&amp;`/`&lt;`; the RSS Best Practices Profile (and the W3C validator) want `&#x26;`/`&#x3C;` there. Otherwise the diff matches the brief and the conventions.

### Decisions
- No entries in a language → no file, no warning; warn once only when no language has an entry (D5).
- Undated posts left out, one warning listing every href (D3/D4). Published = `date`, else `published`; updated = `updated`/`lastmod`/`updatedAt`, else published; an earlier "updated" is ignored (D4). Strings without offset = UTC; impossible dates refused.
- Language = `meta.lang` → `app.lang` → `en`, must be a language tag, else skipped with a warning (D5).
- RSS: `<description>` = summary (`description`, else `lead`), else full HTML; full HTML in `content:encoded`; `atom`/`content`/`dc` namespaces always declared (D7). Escaped, never CDATA; forbidden chars dropped.
- Ids are absolute URLs (D8). Title: config `title` (string or per-language map) → `app.name` → host. Subtitle: config → `app_description` translation. Author: config → `app.name` → title; entry author from frontmatter `author`; RSS uses `dc:creator` (D8). Home link `/index.html` when rendered. Categories from `tags`.
- `app.feeds` computed in `getAppData`; `getAssets` warns on mismatch, pointing at `end:` in `config/plugin-order.yaml`; no origin → `{}` (D9).
- Partial `views/feed-link.pug`, no classes, published via `npx nera-feed` (D9). Added `exclude`; no `output` key in 1.0 (D10). Cache emptied before each write.

### Carry forward
- Review: RSS plain-text elements should use hex character references for `&`/`<` (W3C `CharacterData` warning).
- Cloud: core EBADENGINE for `nopt`/`abbrev` (other repo — generator).
- Cloud: `./bin/…` path warning on `npm publish` (other repo — plugin-tags, in fact 18 packages).
- Cloud: catalog entries `generator/PLUGINS.md` + `nera-website` plugins pages ×3, L8 note in `nera-cli/ROADMAP-ai.md` (other repo, after release).
- Cloud: bootstrap publish 1.0.0, Trusted Publisher, CI 1.0.1 within ~2 days (release).
- Cloud: repo security settings + `fleet-check.sh --fix` (GitHub setting).

## Triage (2026-10-14)

| # | item | from | disposition | why |
|---|---|---|---|---|
| 1 | RSS plain-text elements: `&`/`<` as `&#x26;`/`&#x3C;` (W3C `CharacterData` warning) | review | fix | a few lines in `src/rss.js` + a test; caused by the brief's gap, fix locally before merge |
| 2 | Catalog entries (`PLUGINS.md`, `nera-website` ×3) + L8 spec note | cloud | fix | Step 9 reconcile, after the 1.0.0 bootstrap publish; snippets ready in ROADMAP slice 7 |
| 3 | Bootstrap publish 1.0.0 → Trusted Publisher → CI 1.0.1 | cloud | fix | Step 9 release, user's hands; 1.0.1 can carry #1 if not merged before |
| 4 | Secure the repo: `fleet-check.sh --fix nera-plugin-feed`, private vulnerability reporting, Dependabot alerts, sponsor box | cloud | fix | Step 9, before/at first release |
| 5 | `"./bin/…"` in `bin` makes `npm publish` warn (18 fleet packages) | cloud | file | fleet-wide sweep across many repos, cosmetic |

Already done / elsewhere: core's `nopt`/`abbrev` EBADENGINE warning is a known, documented trade-off (core 4.16.2 CHANGELOG + README), no new work.
Planning signal: the W3C validator is reachable from local, not from the cloud — future feed/sitemap briefs should leave that check to the local pickup.

## Triage decision (2026-10-14)

- User chose **1 — as classified** (2026-10-14).
- #1 fixed locally in `e074f9a` (`src/rss.js`, a test, ROADMAP D7): lint clean, 111/111, scratch site RSS feeds re-checked with the W3C validator → valid, only `SelfDoesntMatchLocation` (rawdata).
- #2–#4 in Step 9; #5 offered as an `/issue` candidate.
