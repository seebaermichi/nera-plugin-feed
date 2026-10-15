# @nera-static/plugin-feed

[![Test](https://github.com/seebaermichi/nera-plugin-feed/actions/workflows/test.yml/badge.svg)](https://github.com/seebaermichi/nera-plugin-feed/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/@nera-static/plugin-feed)](https://www.npmjs.com/package/@nera-static/plugin-feed)

A plugin for the [Nera](https://github.com/seebaermichi/nera) static site generator that writes an [Atom](https://www.rfc-editor.org/rfc/rfc4287) feed of your blog posts at build time, one feed per language, with RSS 2.0 on request. A small partial adds the matching `<link rel="alternate">` to every page, so browsers and feed readers find the feed.

📖 **Documentation:** [nera.js.org](https://nera.js.org)

> Requires `@nera-static/core` **4.13.0 or later** (see [Compatibility](#compatibility)).

## ✨ Features

- One feed per language: `/feed.xml` for the site's language, `/de/feed.xml` for German posts, and so on. Never one mixed feed
- Atom by default, RSS 2.0 (`rss.xml`) or both with one config key
- Posts are the pages with the `pages/post.pug` layout (the same rule as [`@nera-static/theme-blog`](https://www.npmjs.com/package/@nera-static/theme-blog)), newest first, at most 20 per feed
- The post's full HTML as entry content, with every link and image URL made absolute and `base_path`-aware
- Dates only from the frontmatter, never from file dates, and no build time in the output, so the same site gives a byte-identical feed
- A `<link rel="alternate">` partial that links the feed of the page's own language
- Works without configuration

## 🚀 Installation

```bash
npm install @nera-static/plugin-feed
```

Nera detects the plugin and writes the feeds during `nera build`. Set your site's origin in `config/app.yaml`, because a feed needs absolute URLs:

```yaml
origin: https://example.com
```

A site that already uses `@nera-static/plugin-canonical-links` can keep its origin there instead: without `origin` in `config/app.yaml` the plugin reads `app_origin` from `config/canonical-links.yaml`. With neither set, the build prints a warning and writes no feed.

Give each post the post layout and a date:

```markdown
---
layout: pages/post.pug
title: Hello
date: 2026-10-01
description: The first post.
---
Hi, see [about](/about.html).
```

On a site created with `nera new`, `nera build` then writes `public/feed.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
    <title>My Nera Site</title>
    <subtitle>A static site built with Nera</subtitle>
    <link rel="self" type="application/atom+xml" href="https://example.com/feed.xml"/>
    <link rel="alternate" type="text/html" href="https://example.com/index.html"/>
    <id>https://example.com/feed.xml</id>
    <updated>2026-10-01T00:00:00Z</updated>
    <author>
        <name>My Nera Site</name>
    </author>
    <entry>
        <title>Hello</title>
        <link rel="alternate" type="text/html" href="https://example.com/blog/hello.html"/>
        <id>https://example.com/blog/hello.html</id>
        <published>2026-10-01T00:00:00Z</published>
        <updated>2026-10-01T00:00:00Z</updated>
        <summary type="text">The first post.</summary>
        <content type="html">&lt;p&gt;Hi, see &lt;a href=&quot;https://example.com/about.html&quot;&gt;about&lt;/a&gt;.&lt;/p&gt;
</content>
    </entry>
</feed>
```

Your posts use another layout? Set `layouts` in `config/feed.yaml` (see [Configuration](#️-configuration)). When no page is a post, the build prints a warning naming the layouts it looked for.

## 🔗 Linking the feed: the `feed-link` partial

Publish the partial into your site, from the site's root:

```bash
npx nera-feed
```

This copies it to `views/vendor/plugin-feed/feed-link.pug` (`theme/views/vendor/…` on a site with a `theme/` folder). Publishing skips a `vendor/plugin-feed/` folder that already exists, so your edits are never silently overwritten; `npx nera-feed --force` overwrites it. Include the partial in your layout's `<head>`:

```pug
head
    meta(charset="UTF-8")
    title #{ meta.title } | #{ app.name }
    include ../vendor/plugin-feed/feed-link
```

Every page then links the feed of its own language, and nothing when its language has no feed:

```html
<link rel="alternate" type="application/atom+xml" href="/de/feed.xml" title="My Nera Site">
```

That is the markup in a layout starting with `doctype html`. The layout `nera new` scaffolds starts with a literal `<!DOCTYPE html>` line instead, so Pug writes the same tag self-closed (`<link … />`); browsers and feed readers treat both alike.

The partial renders `app.feeds`, which the plugin fills: for each language with a feed, a list of `{ format, type, href, url, title }`, Atom before RSS. `href` already includes `base_path`, `url` is absolute. Use it for a visible link too, for example in a footer:

```pug
each feed in (app.feeds || {})[meta.lang || app.lang] || []
    a(href=feed.href)= feed.format === 'rss' ? 'RSS' : 'Atom feed'
```

## Which pages are entries

A page is an entry when its `layout` is one of `layouts` (default `pages/post.pug`) or its URL matches an `include` pattern. It is left out when:

- it has no `layout` (Nera does not render it);
- its frontmatter sets `feed: false`;
- its `robots` value contains `noindex` (case-insensitive). Without `robots` in the frontmatter, `robots` from `config/app.yaml` counts;
- its URL matches an `exclude` pattern;
- it has no usable date. The build prints one warning listing every such page.

Entries are sorted newest first (by published date, then by URL), and each feed holds at most `limit` of them (default 20).

`include` and `exclude` patterns are matched against the page's path **without** `base_path`, from start to end: `*` matches any characters, including `/`. `/notes/*` matches everything under `pages/notes/`, `/blog/drafts/*` the drafts folder.

## Dates

| Feed field | Frontmatter keys, first usable one wins |
| --- | --- |
| published (`<published>`, RSS `<pubDate>`) | `date`, `published` |
| updated (`<updated>`) | `updated`, `lastmod`, `updatedAt`, else the published date |

A usable date is an unquoted YAML date (`date: 2026-10-01`, `date: 2026-10-01T09:30:00Z`) or a quoted string in the same form (`'2026-10-01'`, `'2026-10-01 09:30'`, `'2026-10-01T11:30:00+02:00'`). A date without a time zone counts as UTC. Atom writes dates as `2026-10-01T09:30:00Z`, RSS as `Thu, 01 Oct 2026 09:30:00 GMT`.

`createdAt` is **never** used: Nera fills it from the file's creation time when the frontmatter has no date, and on CI every file is created at the same moment. A post that only sets `createdAt:` is left out with a warning; add `date:`.

The feed's own `<updated>` is the newest entry's updated date, not the time of the build, so rebuilding an unchanged site gives the same file.

## Entry content

- **Content:** the post's HTML (the Markdown body without the layout, after other plugins such as `@nera-static/plugin-images` changed it). Every `href`, `src`, `srcset` and `poster` URL in it is made absolute: `/img/a.png` becomes `https://example.com/img/a.png` (with `base_path` added), and `a.png` or `../b.html` are resolved against the post's own URL. URLs with a scheme (`https:`, `mailto:`, …), `//…` and `#…` are left as they are.
- **Summary:** `description` from the frontmatter, else `lead`.
- **Title:** `title`, else the post's path. **Author:** `author` (a name). **Categories:** `tags`, a list or a comma-separated string.
- With `content: summary`, entries carry the summary only.

In RSS, `<description>` holds the summary (or the full HTML when there is none) and `<content:encoded>` the full HTML, as most feed readers expect. The author goes into `<dc:creator>`, because RSS's own `<author>` must be an e-mail address.

## Multilingual sites

A page's language is its frontmatter `lang`, else `lang` from `config/app.yaml`. The site's language gets `/feed.xml` (and `/rss.xml`); every other language gets `/<lang>/feed.xml` (and `/<lang>/rss.xml`). A language without posts gets no feed and its pages no link. A `lang` must be a language tag such as `de` or `pt-BR`, because it becomes part of the path; other values are left out with a warning.

The feed title is `name` from `config/app.yaml` unless `title` sets one, for every language or per language. The subtitle is the language's `app_description` translation (the one the default layout uses for `<meta name="description">`) unless `subtitle` sets one.

## `base_path`

On a site deployed under a `base_path` (e.g. `https://example.com/blog/`), every URL in the feed includes it: links, ids, and the URLs inside entry content. Nera only rewrites `base_path` in HTML, CSS and JSON files, so the plugin adds it to the XML itself. A URL in a post that already starts with the `base_path` is not prefixed twice.

## ⚙️ Configuration

Every key is optional, and `config/feed.yaml` itself is optional. The package ships the file with its defaults (`node_modules/@nera-static/plugin-feed/config/feed.yaml`); copy it into your site's `config/` folder to change them:

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

| Key | Type | Default | Invalid value |
| --- | --- | --- | --- |
| `format` | `atom`, `rss` or `both` | `atom` | warning, default used |
| `layouts` | list of strings | `[pages/post.pug]` | a single string is a one-item list; entries that are not non-empty strings are dropped with a warning; any other type → warning, default used |
| `include` | list of strings | `[]` | as `layouts` |
| `exclude` | list of strings | `[]` | as `layouts` |
| `limit` | whole number ≥ 1 | `20` | warning, default used |
| `content` | `full` or `summary` | `full` | warning, default used |
| `title` | string, or language → string | `name` from `config/app.yaml` | warning, ignored |
| `subtitle` | string, or language → string | the language's `app_description` translation | warning, ignored |
| `author` | string | `name` from `config/app.yaml` | warning, ignored |

An unknown key prints a warning and is ignored.

The plugin writes its files to `.nera-cache/feed/` in your site (ignored by git in sites created with `nera new`) and lets Nera copy them into `public/`. A `feed.xml` or `rss.xml` in your own assets folder wins over the generated one. It adds `app.feeds` and nothing to `meta`.

## Plugin order

The plugin decides which languages get a link (`app.feeds`) before the page list is final, and writes the feeds after. If a plugin that runs after it adds or removes posts, the build warns that a link and a feed disagree. List the plugin last in `config/plugin-order.yaml` then:

```yaml
plugin-order:
    - end:
          - plugin-feed
```

## Compatibility

- **`@nera-static/core` 4.13.0 or later** (the `getAssets` hook, through which the feeds reach `public/`). On an older core the build stops with a message naming the required version, rather than exiting cleanly without a feed.
- Node.js 20.19.0 or later (or 22.0.0 or later), like `@nera-static/core`.
- Made for [`@nera-static/theme-blog`](https://www.npmjs.com/package/@nera-static/theme-blog) (1.0.1 or later documents it): it uses the same post rule, and a site fills the theme's empty `feed-link.pug` seam by putting `include /vendor/plugin-feed/feed-link` into its own `theme/views/partials/feed-link.pug`.

## 🧪 Development

```bash
npx vitest run
npm run lint
```

`npm test` runs Vitest in watch mode. The integration tests build throwaway sites with the real `@nera-static/core` in a temp directory, and every generated feed is checked with an XML parser. `ROADMAP.md` records the design decisions behind the plugin.

## 📦 License

MIT
