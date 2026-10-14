# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-10-14

### Fixed

-   README: the `<link rel="alternate">` example now notes that a layout scaffolded by `nera new` (a literal `<!DOCTYPE html>` line) gets the tag self-closed, `<link … />`.

## [1.0.0] - 2026-10-14

### Added

-   First release. Requires `@nera-static/core` 4.13.0 or later (the `getAssets` hook); on an older core the build stops with a message naming the required version.
-   One [Atom](https://www.rfc-editor.org/rfc/rfc4287) feed per language, built from the final page list in `getAssets`: `public/feed.xml` for the site's language (`lang` in `config/app.yaml`), `public/<lang>/feed.xml` for every other language with posts. Written to `.nera-cache/feed/` and copied into `public/` by core. Never one mixed feed; a language without posts gets none.
-   RSS 2.0 at `rss.xml` (and `<lang>/rss.xml`) with `format: rss`, both formats with `format: both`. Items carry the summary in `<description>`, the full HTML in `<content:encoded>` and the author in `<dc:creator>`.
-   Entries: pages whose `layout` is one of `layouts` (default `pages/post.pug`) or whose href matches an `include` pattern; frontmatter `feed: false`, a `robots` value containing `noindex` (frontmatter, else `robots` in `config/app.yaml`), an `exclude` pattern, a missing `layout` or a missing date leave a page out. Newest first, ties by href, at most `limit` (default 20) per feed.
-   Dates only from frontmatter: published from `date`, else `published`; updated from `updated`, `lastmod` or `updatedAt`, else the published date. `createdAt` is never used, because core may fill it from the file's creation time; posts without a usable date are left out with one warning listing them. The feed's `<updated>` is the newest entry's, never the build time, so the output is byte-identical for the same site.
-   Absolute URLs everywhere: `origin` from `config/app.yaml`, else `app_origin` from `config/canonical-links.yaml`, plus `base_path`, plus the page's href, percent-encoded and XML-escaped; ids are these URLs. Without an origin the build warns and writes no feed.
-   Entry content: the post's rendered HTML (after other plugins changed it), with `href`, `src`, `srcset` and `poster` URLs made absolute and `base_path`-aware; the summary from `description`, else `lead`; categories from `tags`; the author from `author`. `content: summary` leaves the HTML out.
-   `app.feeds`: per language, the list of its feeds (`format`, `type`, `href` with `base_path`, absolute `url`, `title`), and the partial `views/feed-link.pug`, published with `npx nera-feed`, rendering a `<link rel="alternate">` per feed of the page's language. A warning when a later plugin changes the posts so that links and feeds disagree.
-   `config/feed.yaml` with `format` (default `atom`), `layouts` (default `[pages/post.pug]`), `include` and `exclude` (default `[]`), `limit` (default 20), `content` (default `full`), and optional `title` and `subtitle` (a string or one per language; defaults `name` from `config/app.yaml` and the language's `app_description` translation) and `author` (default `name`). Invalid values and unknown keys warn and fall back to the default.
