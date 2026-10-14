# ROADMAP — `@nera-static/plugin-feed`

An Atom feed (RSS 2.0 on request) of a Nera site's blog posts, one feed per language, built at build time from the final page list, plus a `<link rel="alternate">` partial so browsers and feed readers find it.

**This file is the single source of truth for the plugin. Extend it; never start a parallel document.** A decision made while working an issue is written back here in the same commit. Each slice below is one plan step; tick it and add a dated `**Done YYYY-MM-DD**` note with anything learned.

Written 2026-10-14 for the Snagio issue `01a1260d-904a-70a2-a284-b3a8b28df73a` ("Atom/RSS feed plugin, per language"). `nera-cli/ROADMAP-ai.md` L8 asks for the plugin and points here for the design.

---

## Where it comes from

`nera-cli/ROADMAP-ai.md` L8 ("Missing plugins") lists `@nera-static/plugin-feed` — RSS/Atom for blogs, per language — next to `@nera-static/plugin-sitemap` (built 2026-10-11, the model for this repo). The planned `@nera-static/starter-blog` needs both.

The planned `@nera-static/theme-blog` (`generator/ROADMAP-themes.md`, §S4) reserves a seam for this plugin: an empty `partials/feed-link.pug`, included at the end of `head.pug` before `head-extra.pug`, with `app` and `meta` in scope, meant for this plugin's `<link rel="alternate">`; a footer link to the feed goes in `footer-extra.pug`. The blog starter fills the seam with this plugin's partial once the plugin is on npm. theme-blog defines posts as the pages whose `meta.layout` is listed in `blog.post_layouts` (default `['pages/post.pug']`) in the page's language, newest first by date — this plugin uses the same rule and default (D3), so a theme-blog site needs no feed config at all.

The repository started empty apart from the Snagio issue workflow (`6301aa7`).

## The problem

A Nera blog has no feed unless its author writes one by hand, and a hand-written feed is stale the moment a post is added. Feed readers, aggregators and "follow" buttons all expect one. A multilingual blog needs one per language: a reader subscribed to the German posts does not want the English ones.

## The goal

A site adds the plugin, sets `origin` in `config/app.yaml`, writes its posts with `layout: pages/post.pug` and a `date:`, and `nera build` writes `public/feed.xml` for the default language:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
    <title>Demo</title>
    <link rel="self" type="application/atom+xml" href="https://example.com/feed.xml"/>
    <link rel="alternate" type="text/html" href="https://example.com/index.html"/>
    <id>https://example.com/feed.xml</id>
    <updated>2026-10-05T00:00:00Z</updated>
    <author>
        <name>Demo</name>
    </author>
    <entry>
        <title>Hello</title>
        <link rel="alternate" type="text/html" href="https://example.com/blog/hello.html"/>
        <id>https://example.com/blog/hello.html</id>
        <published>2026-10-01T00:00:00Z</published>
        <updated>2026-10-05T00:00:00Z</updated>
        <summary type="text">The first post.</summary>
        <content type="html">&lt;p&gt;Hi, see &lt;a href=&quot;https://example.com/about.html&quot;&gt;about&lt;/a&gt;.&lt;/p&gt;
</content>
    </entry>
</feed>
```

(The line break before `</content>` is markdown-it's, which ends every block with a newline; the content is kept as rendered.)

and `public/de/feed.xml` with the German posts (`xml:lang="de"`, its own `self` link and `id`). A page includes the partial in its `<head>` and gets the link for its own language:

```html
<link rel="alternate" type="application/atom+xml" href="/de/feed.xml" title="Demo">
```

No config file is needed; every key has a default (D10).

---

## Verified facts this design rests on (2026-10-14, core 4.16.2 in `node_modules/@nera-static/core/src/`)

The brief's facts were checked against core 4.16.2 (plugin-sitemap checked the same against 4.15.1 on 2026-10-11); nothing relevant changed.

- **Plugin contract.** `setup-plugins.js` step 5 calls, per plugin in order, `getAppData({ app, pagesData })` (result kept only when a plain object, else a console warning) and `getMetaData` (kept only when an array). Order: `config/plugin-order.yaml` `start:`, then the rest alphabetically by name, then `end:`. Each plugin's `getAppData` therefore sees `pagesData` after the `getMetaData` of the plugins before it only.
- **`getAssets` runs after every plugin's `getAppData`/`getMetaData`** (step 6) with the final `app` and `pagesData`, so it sees content other plugins rewrote and pages they generated. An entry is `{ from, to }`, `from` absolute, `to` relative to `public/` (`validateAsset` rejects absolute or `..`). Since core **4.13.0**; an older core never calls it.
- **Copy order** (`index.js#run`): `deleteFolder(dist)` after the plugins ran, then `createHtmlFiles`, then theme assets → plugin assets → site assets, so a hook's direct write into `public/` is lost and a site's own `assets/feed.xml` wins over the plugin's.
- **`meta.href` is logical** (`core.js#getPagesData`): `/<path>.html`, leading slash, never prefixed with `base_path`. Frontmatter keys are spread into `meta` first, then core sets `createdAt`, `href`, `fullPath`, `dirname`, `filename`.
- **`content`** in pagesData is the Markdown body rendered by markdown-it (`html: true`), without the layout. Core's `base_path` rewrite (`rewriteHtmlUrls`) runs on the **rendered page HTML** inside `createHtmlFiles`, never on `pageData.content`, and `rewriteAssetUrls` touches only `.css`, `.webmanifest`, `.json`; a `.xml` file is copied untouched. So the plugin applies `app.basePath` itself, in the feed's links and inside entry content.
- **`base_path`** is normalised to `app.basePath` (`''` or `/foo`, `normalizeBasePath`). The HTML rewrite skips values already starting with `basePath + '/'`, so a template may write a prefixed href without it being prefixed twice.
- **Dates.** Frontmatter is parsed with `yaml` and `{ schema: 'core', customTags: ['timestamp'] }`: unquoted `date: 2026-01-02` → a `Date` at UTC midnight, quoted → a string. `createdAt = frontmatter.createdAt || frontmatter.date || fs.statSync().birthtime`; the plugin cannot tell the birthtime fallback from an authored value.
- **Templates** get `{ ...data, ...pageData }` — `app`, `meta`, `content`, `pagesData`, plus `t()` (`app.translations[meta.lang || app.lang][key] || key`) and `url()`. Only pages with `meta.layout` are rendered.
- **The `nera new` scaffold** (`@nera-static/nera` 1.11.1, `template/`) writes `config/app.yaml` with `lang: en`, `name: My Nera Site`, `robots: index,follow` and `translations.en.app_description` — no `origin`. Its layout's `<head>` uses `app.name`, `t('app_description')` and `meta.robots || app.robots`. Its `.gitignore` has `.nera-cache`. Its default page layout is `pages/default.pug`, so a scaffolded site has no posts until it uses `pages/post.pug` or sets `layouts` (D3).
- **Templates are published** with `publishTemplates({ pluginName, sourceDir, templateFiles, force })` from `@nera-static/plugin-utils` 1.6.1 into `<views>/vendor/<pluginName>/` (`theme/views/vendor/…` on a theme-folder site), skipped when that folder exists unless `--force`.
- **The npm name is free.** `npm view @nera-static/plugin-feed` returned 404 on 2026-10-14.

---

## Decisions

### D1 — Generate in `getAssets`, write to `.nera-cache/feed/`

The feeds are built in `getAssets`, the only hook that sees the final page list and content (plugin-images' `<picture>`, plugin-code-blocks' markup). Each feed is written to `<site>/.nera-cache/feed/<to>` and returned as `{ from, to }` so core copies it into `public/`; nothing is written into `public/` directly. Hooks are synchronous and return the right shape in every branch. Like plugin-sitemap (its D1), `getAppData` runs the core-version guard (`src/guard.js`) and fails the build on a core older than 4.13.0, and `peerDependencies` declares `@nera-static/core >=4.13.0`. A site that ships its own `assets/feed.xml` keeps it (core's copy order).

### D2 — URLs = origin + basePath + `meta.href`, percent-encoded

Every URL in a feed (self link, home link, entry link, entry id, URLs in content) is absolute: `origin + app.basePath + path`, with sitemap's `joinUrl`/`encodePath` (percent-encodes what a URL may not contain, never double-encodes an existing `%XX`). The origin is `app.origin`, else `app_origin` in `config/canonical-links.yaml`, trailing slashes trimmed (sitemap's `resolveOrigin`). Without an origin the build warns once, naming both places, and writes no feed (relative URLs are invalid in a feed); `app.feeds` is then empty, so no page links a missing feed.

### D3 — Which pages are entries

A page is a candidate when its `meta.layout` is in the config key `layouts` (default `['pages/post.pug']`, theme-blog's `blog.post_layouts` default) **or** its `href` matches an `include` pattern. Patterns (`include`, `exclude`) are matched against the logical `href`, `*` matching any run of characters including `/`, anchored at both ends — sitemap's `exclude` matcher. A candidate is left out when:

- it has no `layout` (core never renders it — an `include` pattern cannot add it) or no non-empty string `href`;
- its frontmatter says `feed: false`;
- its effective robots (`meta.robots || app.robots`) contains `noindex` (case-insensitive);
- its `href` matches an `exclude` pattern (added here for symmetry with plugin-sitemap; `feed: false` is the per-page way);
- it has no usable date (D4) — skipped with **one** warning per build listing every such `href`, because a post without a date cannot be ordered and would otherwise be silently missing;
- its language is not a valid language tag (D5) — one warning naming the pages.

Duplicate `href`s keep the first in `pagesData` order. Entries are sorted newest first by published date, ties by `href` (plain string order), and each feed holds at most `limit` entries (default 20).

### D4 — Dates only from authored frontmatter

- **Published** (`<published>`, RSS `<pubDate>`): frontmatter `date`, else `published`. `createdAt` is **never** used — core may have filled it from the file's birth time, which CI stamps the same on every file. `published` is supported because it is Atom's own name and common in imported posts; it is the second choice, so theme-blog's `date` wins.
- **Updated** (`<updated>`): `updated` (theme-blog's key), else `lastmod`, else `updatedAt` (plugin-sitemap's keys), else the published date. An updated date before the published one is taken for a typo and the published date is used.
- A usable date is a valid `Date` (what YAML makes of an unquoted date), or a string `YYYY-MM-DD`, optionally followed by `T` or a space, `hh:mm`, optional `:ss` and fraction, and an optional `Z`/`±hh:mm` offset; a date-only string or one without an offset is read as UTC (as YAML does for unquoted values). Anything else does not count; an unusable `updated` falls through to the next key.
- Atom dates are RFC 3339 in UTC without milliseconds (`2026-10-01T00:00:00Z`); RSS dates are RFC 822 (`Thu, 01 Oct 2026 00:00:00 GMT`, `Date#toUTCString`).
- The feed-level `<updated>` (RSS `<lastBuildDate>`) is the newest entry's updated date — never "now" — so the same site gives a byte-identical feed.

### D5 — One feed per language, fixed paths

A page's language is `meta.lang`, else `app.lang`, else `en` (when `app.lang` is missing too; the scaffold always sets it). The default language (`app.lang`, else `en`) gets `feed.xml` (and `rss.xml`) at the root of `public/`; every other language gets `<lang>/feed.xml` (and `<lang>/rss.xml`). Pages are grouped by language; there is never a merged multi-language feed. A language with no entry gets no file and **no warning** (a language may have no posts yet, and pages in it simply get no link); only when **no** language has an entry does the build warn once, naming `layouts`, because the feed plugin is then installed for nothing (usually the posts' layout differs from the default). A language must be a language tag (`^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$`, e.g. `en`, `pt-BR`) because it becomes a path segment and `xml:lang`; pages with another value are skipped with one warning. The output paths are not configurable in 1.0 (O2).

### D6 — Formats

`format: atom` (default) writes Atom 1.0 (RFC 4287) at `feed.xml`; `format: rss` writes RSS 2.0 only, at `rss.xml`; `format: both` writes both. Atom is the default because it is fully specified (required ids, typed content, time zones) where RSS 2.0 leaves these open.

### D7 — Content, summaries and URL absolutizing

- `content: full` (default): the page's rendered HTML (`content` in pagesData, after every plugin's `getMetaData`) as Atom `<content type="html">`, XML-escaped (never CDATA, so `]]>` in a post cannot break the file). `content: summary`: no content element.
- The summary is `meta.description`, else `meta.lead`, as plain text: Atom `<summary type="text">`, written in both modes when there is one.
- **RSS 2.0**: `<description>` is the summary, else (only with `content: full`) the full HTML; with `content: full` the full HTML also goes into `content:encoded` (the `content` module, `xmlns:content="http://purl.org/rss/1.0/modules/content/"`). This keeps `<description>` a short summary for readers that show one and still gives the full post to readers that use `content:encoded` — the common practice. An item with neither (summary mode, no summary) has only its title and link, which RSS allows.
- Before escaping, URLs in the content are made absolute: the values of `href`, `src`, `poster` (and every URL in a `srcset` list) in double- or single-quoted attributes. A root-relative `/x` becomes `origin + basePath + /x` (left unprefixed when it already starts with `basePath/`, as core's rewrite does); a relative `x`, `./x`, `../x`, `?q` is resolved against the page's own absolute URL. Values with a scheme (`http:`, `https:`, `mailto:`, `tel:`, `data:`, …), protocol-relative `//…`, fragments `#…` and empty values are left alone. Unquoted attribute values are not touched (markdown-it always quotes).
- XML text (titles, summaries, content) is escaped (`&`, `<`, `>`, `'`, `"`) and characters XML 1.0 forbids (C0 controls other than tab/LF/CR, U+FFFE/U+FFFF, lone surrogates) are dropped, so any page text gives a well-formed file. In RSS 2.0, whose readers may read any element as HTML, plain-text elements (titles, `<category>`, `<dc:creator>`, the channel `<description>` and an item `<description>` holding the summary) write `&` and `<` as `&#x26;` and `&#x3C;`, as the RSS Best Practices Profile asks and the W3C Feed Validator checks; escaped HTML keeps `&amp;`/`&lt;`.

### D8 — Ids, titles and authors

- **Ids** are absolute URLs: the feed's `<id>` is its own URL, an entry's `<id>` (RSS `<guid isPermaLink="true">`) is the page URL. They never contain a date, so editing a post's date does not make readers show it twice. (Tag URIs would survive a domain move but need an authored "minted" date per post; not worth it for 1.0.)
- **Feed title**: config `title` for the language (a string for every language, or a mapping `{ en: …, de: … }`), else `app.name`, else the origin's host.
- **Feed subtitle** (Atom `<subtitle>`, RSS channel `<description>`): config `subtitle` (string or mapping), else `app.translations[lang].app_description` (what the scaffold's layout uses for `<meta name="description">`), else none. RSS requires a channel description, so it falls back to the title there.
- **Feed author** (Atom feed `<author><name>`, always written so every entry has one as RFC 4287 requires): config `author`, else `app.name`, else the feed title. An entry gets its own `<author>` when its frontmatter has a non-empty string `author`. RSS 2.0's `<author>` must be an e-mail address, so RSS items carry the frontmatter author as `<dc:creator>` (Dublin Core, `xmlns:dc`), and the channel names none.
- **Entry title**: `meta.title`, else the `href`. **Home link** (Atom `<link rel="alternate">` of the feed, RSS `<link>`): the language's index page (`/index.html`, `/<lang>/index.html`) when it is a rendered page, else the site root (`/`, `/<lang>/`).
- **Categories**: frontmatter `tags` (a list of strings, or a comma-separated string as plugin-tags reads it) become Atom `<category term="…"/>` and RSS `<category>`, in the order written, duplicates and empty values dropped.

### D9 — `app.feeds` and the `<link rel="alternate">` partial

`getAppData` writes **`app.feeds`**: a mapping from language to the list of that language's feeds, each `{ format, type, href, url, title }` — `format` `atom`/`rss`, `type` the MIME type (`application/atom+xml`, `application/rss+xml`), `href` root-relative **with** `base_path` (`/sub/de/feed.xml`; core's HTML rewrite leaves it alone), `url` absolute, `title` the feed title (D8). Atom comes before RSS. A language is listed when it has at least one entry as far as `getAppData` can see.

`getAppData` sees `pagesData` before the `getMetaData` of the plugins ordered after this one, so pages those plugins add or remove are not counted there; their content is irrelevant to the decision. `getAssets` sees the final list and warns when the two disagree (a language linked but without a feed file, or a feed written but not linked), naming the language and pointing at `config/plugin-order.yaml`. With no origin `app.feeds` is `{}`. The hook never fails on config: it reads the config silently and `getAssets` reports the problems, so each warning appears once.

`views/feed-link.pug` renders one `<link rel="alternate" type="…" href="…" title="…">` per feed of the **current page's** language (`meta.lang || app.lang || 'en'`), nothing when there is none. No classes (head links need none). Published from the site with `npx nera-feed` (the package's `bin`, which the plugin repo also runs as `npm run publish-template`) to `views/vendor/plugin-feed/feed-link.pug`; a layout includes it in its `<head>`, and theme-blog's `partials/feed-link.pug` seam can be a one-line include of it.

### D10 — Config (all optional)

Read from the site's `config/feed.yaml` (`app.folders.config` honoured) via `getConfig` from `@nera-static/plugin-utils`, inside each hook. A missing file gives a working feed. Every invalid value warns (in `getAssets` only, D9) and falls back to its default; an unknown key warns and is ignored. No runtime dependency besides `@nera-static/plugin-utils`; the XML is written by hand as in plugin-sitemap.

---

## Configuration — `config/feed.yaml`

```yaml
# atom (feed.xml), rss (rss.xml, RSS 2.0) or both.
format: atom

# Posts are the pages whose `layout` is one of these (theme-blog's default).
layouts:
    - pages/post.pug

# More pages by logical href (without base_path). "*" matches any characters.
include: []
#   - /notes/*

# Pages to leave out by logical href. A page can also set `feed: false`.
exclude: []
#   - /blog/drafts/*

# Entries per feed, newest first.
limit: 20

# full: the post's HTML as entry content; summary: description/lead only.
content: full

# Feed title, for every language or per language. Default: `name` in
# config/app.yaml.
# title: My Blog
# title:
#     en: My Blog
#     de: Mein Blog

# Feed subtitle, a string or per language. Default: the `app_description`
# translation of the language.
# subtitle: Notes on things

# The feed's author. Default: `name` in config/app.yaml.
# author: Jane Doe
```

| key | type | default | invalid value |
|---|---|---|---|
| `format` | `atom` \| `rss` \| `both` | `atom` | anything else → warning, default used |
| `layouts` | list of strings | `['pages/post.pug']` | a single string is a one-item list; non-strings and empty strings dropped with a warning; another type → warning, default used |
| `include` | list of strings | `[]` | as `layouts` |
| `exclude` | list of strings | `[]` | as `layouts` |
| `limit` | positive integer | `20` | not a whole number ≥ 1 → warning, default used |
| `content` | `full` \| `summary` | `full` | anything else → warning, default used |
| `title` | string or mapping language → string | — (`app.name`) | not a non-empty string or a mapping of them → warning, ignored; a mapping's bad values dropped with a warning |
| `subtitle` | string or mapping language → string | — (`app_description` translation) | as `title` |
| `author` | string | — (`app.name`) | not a non-empty string → warning, ignored |

A key present but empty (`limit:`) counts as absent. An unknown key warns and is ignored.

Frontmatter keys the plugin reads: `layout`, `href` (from core), `lang`, `feed`, `robots`, `title`, `date`, `published`, `updated`, `lastmod`, `updatedAt`, `description`, `lead`, `author`, `tags`; from `config/app.yaml` it reads `origin`, `name`, `lang`, `robots`, `translations` and core's `basePath`/`folders`. It writes `app.feeds` (D9) and no `meta.<key>`.

---

## XML shapes (the public contract)

Atom (`feed.xml`, `<lang>/feed.xml`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="{lang}">
    <title>{title}</title>
    <subtitle>{subtitle}</subtitle>   <!-- only when D8 finds one -->
    <link rel="self" type="application/atom+xml" href="{feed URL}"/>
    <link rel="alternate" type="text/html" href="{home URL}"/>
    <id>{feed URL}</id>
    <updated>{newest entry's updated, RFC 3339}</updated>
    <author>
        <name>{feed author}</name>
    </author>
    <entry>   <!-- newest first, at most `limit` -->
        <title>{title}</title>
        <link rel="alternate" type="text/html" href="{page URL}"/>
        <id>{page URL}</id>
        <published>{RFC 3339}</published>
        <updated>{RFC 3339}</updated>
        <author>   <!-- only with frontmatter `author` -->
            <name>{author}</name>
        </author>
        <category term="{tag}"/>   <!-- per tag -->
        <summary type="text">{description or lead}</summary>   <!-- when there is one -->
        <content type="html">{escaped HTML, absolute URLs}</content>   <!-- content: full -->
    </entry>
</feed>
```

RSS 2.0 (`rss.xml`, `<lang>/rss.xml`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
    <channel>
        <title>{title}</title>
        <link>{home URL}</link>
        <description>{subtitle, else title}</description>
        <language>{lang}</language>
        <lastBuildDate>{newest entry's updated, RFC 822}</lastBuildDate>
        <atom:link href="{feed URL}" rel="self" type="application/rss+xml"/>
        <item>   <!-- newest first, at most `limit` -->
            <title>{title}</title>
            <link>{page URL}</link>
            <guid isPermaLink="true">{page URL}</guid>
            <pubDate>{published, RFC 822}</pubDate>
            <dc:creator>{author}</dc:creator>   <!-- only with frontmatter `author` -->
            <category>{tag}</category>   <!-- per tag -->
            <description>{summary, else escaped HTML with content: full}</description>   <!-- when there is one -->
            <content:encoded>{escaped HTML, absolute URLs}</content:encoded>   <!-- content: full -->
        </item>
    </channel>
</rss>
```

UTF-8, four-space indentation, `\n` line endings, a trailing newline. The namespaces are always declared, so the root line does not change with the content. Changing these shapes, the output paths, a config key or its default, `app.feeds` or the partial's markup is a contract change (see "Semver notes").

---

## Slices

Each slice is one step of the cloud brief's plan (`plans/cloud/01a1260d-904a-70a2-a284-b3a8b28df73a-result.md`).

### Slice 1 — This ROADMAP

- [x] Origin, problem, goal, verified facts, D1–D10, config reference, XML shapes, slices, open items, release handover.

**Done 2026-10-14.** Facts checked against core 4.16.2 in `node_modules` and the `nera new` template of `@nera-static/nera` 1.11.1; the maintainer's decisions of 2026-10-14 (format, entries, content, per-language paths) are D3, D5, D6 and D7.

### Slice 2 — Package scaffold like the fleet

- [x] `package.json` (1.0.0, `bin` `nera-feed`, `publish-template`), lockfile from npm 10.9, `eslint.config.js`, `LICENSE`, `.husky/`, `.github/` (test, publish, dependabot, FUNDING), `.gitignore`, placeholder hooks + smoke test.

**Done 2026-10-14.** Copied from plugin-sitemap (its `publish.yml` is byte-identical to plugin-code-blocks', checked); dependencies as there plus `fast-xml-parser` (well-formedness checks) and `pug` (partial render test) as devDependencies, `@nera-static/core` `^4.16.2`. Lockfile from npm 10.9.4 on Node 22.22.0. The repo's `.gitignore` lacked `.nera-cache/` (where the plugin's tests and a local site build write) and `.playwright-mcp/`; both added in their own commit. The `bin` path is written `bin/publish-template.js` without `./`, because `npm publish` otherwise "cleans" it with a warning.

### Slice 3 — Pure builders

- [x] `src/urls.js`, `src/dates.js`, `src/content.js`, `src/entries.js`, `src/atom.js`, `src/rss.js`, unit-tested; every generated feed checked for well-formedness by an XML parser in the tests.

**Done 2026-10-14.** `src/urls.js` is plugin-sitemap's (`trimOrigin`, `encodePath`, `joinUrl`, `matchesPattern`; its `isExcluded` is `matchesAny` here, since `include` uses it too), and `escapeXml` also drops the characters XML 1.0 forbids (D7). `collectEntries` returns the groups plus the `undated` and `badLanguage` hrefs, so the builder stays free of console output and the hook warns once. `toDate` refuses calendar dates that do not exist (`2026-02-30`), which `Date` would roll over. The serializers take a resolved view model (absolute URLs, plain text) and escape everything themselves. `test/helpers.js` gained `expectWellFormed`: fast-xml-parser's `XMLValidator` (a devDependency) plus two checks it does not make — forbidden characters and undefined entity references such as `&nbsp;`.

### Slice 4 — Config, guard and hooks

- [x] `src/config.js`, `src/guard.js`, `src/warn.js`, `src/feeds.js`, `getAppData` (guard + `app.feeds`) and `getAssets` (cache files + entries), `config/feed.yaml`.

**Done 2026-10-14.** `src/config.js` follows plugin-sitemap's (`normalizeConfig`, `loadConfig`, `resolveOrigin`), with a `warn` parameter so `getAppData` can read the config silently (D9). `src/guard.js` and `src/warn.js` are plugin-sitemap's with the names changed. `src/feeds.js` holds the output paths, titles, authors, entry view models, `feedLinks` (→ `app.feeds`) and `buildFeeds`. `getAssets` empties `.nera-cache/feed/` before writing, so a feed a language no longer has cannot linger in the cache. A test checks that the packaged `config/feed.yaml` normalizes to exactly the JS defaults.

### Slice 5 — The `<link>` partial

- [x] `views/feed-link.pug`, `bin/publish-template.js`, render test with `pug`.

**Done 2026-10-14.** `bin/publish-template.js` is plugin-tags' with one template file; `package.json` has the `nera-feed` bin and the `publish-template` script. The partial reads `app.feeds[meta.lang || app.lang || 'en']` and renders one `link(rel='alternate' type=… href=… title=…)` per feed, nothing otherwise; it has no classes. `test/template.test.js` renders it inside a `doctype html` layout (pug writes `<link …>` without `/>` only under that doctype, as in a site's layout) and runs the bin in a throwaway site: first publish, an edited copy kept, `--force` overwriting it.

### Slice 6 — Integration test through core `run()`

- [x] Throwaway sites built with core's `run()`: two languages without config, `base_path` + `format: both`, `content: summary`, no origin, the partial in a layout; byte-identical rebuild; every feed parsed.

**Done 2026-10-14.** `test/integration.test.js` loads `index.js` as a local plugin (`plugins/feed/index.js` re-exporting it) with the partial published to `views/vendor/plugin-feed/`, and builds four sites with core 4.16.2's `run()`: a bilingual site without `config/feed.yaml` (exact `public/feed.xml` and `public/de/feed.xml`; `feed: false`, `noindex`, undated and layout-less posts absent, the undated one named in the only warning; each page's head links its own language's feed; a byte-identical second build), a `base_path: /sub/` site with the origin from canonical-links and `format: both` (every URL in all four files starts with `https://example.org/sub/` exactly once — links, ids, `href`/`src`/`srcset` in content, including an `src` already written with `/sub/`), a `content: summary` + `limit: 1` + per-language `title` site, and a site without an origin (one warning, no feed, no link). Every feed is checked with `expectWellFormed`. `test/helpers.js` is plugin-sitemap's (`build`, `tempDir` with cleanup, `write`) with the `nera-feed-` prefix; no temp dir is left behind.

### Slice 7 — README, CHANGELOG, release preparation

- [x] README, `CHANGELOG.md` `## [1.0.0]`, `npm pack --dry-run`, catalog snippets, release handover.

**Done 2026-10-14.** README follows plugin-sitemap's (badges, nera.js.org link, Compatibility, Development, License) plus the partial, `app.feeds`, dates, content, multilingual, `base_path` and plugin-order sections; its example feed is the output of a build of the `nera new` scaffold's `config/app.yaml` plus an `origin` (hence the `<subtitle>` from `app_description`). Template publishing is documented as `npx nera-feed`, like plugin-tags' `npx nera-tags`. `CHANGELOG.md` carries `## [1.0.0] - 2026-10-14`. `npm pack --dry-run` ships `index.js`, `src/`, `config/`, `views/`, `bin/`, `README.md`, `CHANGELOG.md`, `LICENSE`, `package.json` only. The catalog entries and the handover are below; nothing was published, tagged, pushed to `main` or committed outside this repo.

#### Release handover

**Released 2026-10-14.** The hand publish of 1.0.0 landed as a *staged* version, so the `v1.0.0` tag's CI run failed with `E409 Cannot publish over previously staged version "1.0.0"` (expected either way); 1.0.0 was then promoted on npmjs.com. 1.0.1 (a README note) was the first CI OIDC publish and validates the Trusted Publisher. The repo is secured like the fleet (`fleet-check.sh --fix`, private vulnerability reporting, Dependabot alerts and fixes, Sponsorships), and the plugin is listed in `generator/PLUGINS.md` (18) and the three `nera-website` catalog pages. The steps below are kept as the record.

Not run by the session (never publish, tag or push `main`). In order:

1. Review and merge the branch `issue/01a1260d-feed-plugin` into `main` and push `main`. Then `generator/scripts/fleet-check.sh --fix nera-plugin-feed` from the workspace root, and secure the repo like the fleet (`protect-main` ruleset, secret scanning + push protection, private vulnerability reporting, Dependabot alerts and security updates; `.github/dependabot.yml` is already in the repo).
2. Bootstrap-publish 1.0.0 by hand from this repo: `npm ci && npx vitest run && npm run lint && npm publish --access public`, then `git tag -a v1.0.0 -m v1.0.0 && git push origin v1.0.0` (the tag's CI publish fails on the existing version; that is expected).
3. On npmjs.com, add the Trusted Publisher: repository `seebaermichi/nera-plugin-feed`, workflow `publish.yml`.
4. Within ~2 days, a real CI release so the Trusted Publisher does not expire: a patch change with its CHANGELOG entry, `npm version patch --no-git-tag-version`, commit, then `git tag -a v1.0.1 -m v1.0.1 && git push origin main v1.0.1`.
5. Catalog entries (below) in `generator/PLUGINS.md` and the three `nera-website` pages; `nera build` + `nera validate` in `nera-website`, then push.
6. `nera-cli/ROADMAP-ai.md` L8: point to this ROADMAP and record the release. The blog starter can then fill theme-blog's `partials/feed-link.pug` seam with `include ../vendor/plugin-feed/feed-link`.

`generator/PLUGINS.md` — after "Contact form", before "Images", and the heading becomes `## List of plugins (18)`:

```markdown
-   [Feed](https://github.com/seebaermichi/nera-plugin-feed)
```

`nera-website/pages/plugins/index.md` — after "Contact form" in the `plugins:` list:

```yaml
    - name: Feed
      package: '@nera-static/plugin-feed'
      description: Generates an Atom or RSS feed of your blog posts, one per language, and a link tag for the page head.
      url: https://github.com/seebaermichi/nera-plugin-feed
```

`nera-website/pages/de/plugins/index.md`, same place:

```yaml
    - name: Feed
      package: '@nera-static/plugin-feed'
      description: Generiert einen Atom- oder RSS-Feed der Blogbeiträge, einen pro Sprache, und ein Link-Tag für den Seitenkopf.
      url: https://github.com/seebaermichi/nera-plugin-feed
```

`nera-website/pages/es/plugins/index.md`, same place:

```yaml
    - name: Feed
      package: '@nera-static/plugin-feed'
      description: Genera un feed Atom o RSS de las entradas del blog, uno por idioma, y una etiqueta link para la cabecera de la página.
      url: https://github.com/seebaermichi/nera-plugin-feed
```

---

## Open items

- **O1 — Feed pagination / archives** (RFC 5005). A feed holds the newest `limit` posts only; paged or archived feeds are a later minor.
- **O2 — Configurable output paths.** `feed.xml`/`rss.xml` are fixed in 1.0; a site that needs another name can ship its own file or ask for an `output` key (minor).
- **O3 — A feed per tag or section** (e.g. `/tags/x/feed.xml`). Not in 1.0.
- **O4 — `getAppData` sees a partial page list** (D9). A later core hook that runs after every `getMetaData` but before rendering would let `app.feeds` be exact; until then the mismatch warning covers it.

## Semver notes for later changes

Public contract: the config keys and their defaults, the output paths, the XML shapes above, which frontmatter keys include, exclude, date or describe an entry, `app.feeds` and its shape, and the markup of `views/feed-link.pug`. Removing or renaming any of these, or changing a default's meaning, is **major**. A new optional key, element or template is **minor**. A fix that makes the output match this document is **patch**.

## Not in scope (for now)

- JSON Feed, podcast/enclosure elements (`<enclosure>`, iTunes tags), WebSub/PubSubHubbub hubs.
- Feed styling (XSLT) for browsers.
- A footer link template; the README shows the one-liner and theme-blog's `footer-extra.pug` is the place for it.

## Acceptance criteria

- [x] The repo has its own `ROADMAP.md` as the plugin's spec (L8 points to it — the pointer in `nera-cli/ROADMAP-ai.md` is part of the release handover).
- [x] A site depending on the plugin gets one valid Atom feed per language with absolute, escaped, `base_path`-aware URLs, RSS 2.0 on request (slice 6's integration test).
- [x] Pages link their language's feed through the published partial (D9).
- [x] The package matches the fleet (CI workflows, LICENSE, README linking nera.js.org, CHANGELOG, `files`); publishing is the release handover's.
- [x] The PLUGINS.md and three website catalog entries are prepared for the release handover (slice 7).
