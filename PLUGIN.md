# Extension reference

Technical reference for maintainers/contributors. User-facing docs live in `README.md` and the [docs site](https://smarttab.bytebox.network); contribution workflow lives in `CONTRIBUTING.md`.

## Architecture

- `manifest.json` — MV3 manifest. Permissions: `tabs`, `tabGroups`, `storage`, `contextMenus`. Deliberately no `host_permissions` — the extension never reads page content, only tab URLs.
- `background.js` — MV3 service worker. Watches tab creation, URL updates, and new windows, and auto-organizes tabs into groups using the active rule set. Loads the matcher via `importScripts('rules.js')`.
- `rules.js` — shared rule-matching engine used by both `background.js` (service worker, via `importScripts`) and `popup.js` (popup page, via a `<script>` tag). Single source of truth so the two surfaces can't drift apart.
- `popup.html` / `popup.js` — toolbar popup: manual Organize, Reorder, Group current tab, Ungroup current tab actions.
- `options.html` / `options.js` — settings UI: named rule sets, per-group domain rules and colors, unmatched-tab grouping, ignore-pinned option, Chrome sync toggle, import/export JSON, help text.

## Documentation site

`docs/` is published via GitHub Pages (`main` branch, `/docs` path — confirmed via the repo's Pages API settings) at `https://smarttab.bytebox.network`.

- `docs/index.html` — the whole site (single page): features, screenshots, install steps, rule syntax, privacy summary, release notes.
- `docs/CNAME` — custom domain for GitHub Pages.
- `docs/.nojekyll` — disables Jekyll processing (the site is plain static HTML).
- `docs/sitemap.xml` / `docs/robots.txt` — SEO basics; keep the sitemap's URL list and `index.html`'s canonical/OG tags in sync if pages are ever added.
- `docs/.well-known/security.txt` — RFC 9116 vulnerability-disclosure contact for the site; mirrors `SECURITY.md` at the repo root, which covers GitHub's own "Report a vulnerability" UI.

The "Rule syntax" and "Release notes" sections in `docs/index.html` are hand-maintained and don't auto-generate from `options.html`'s Help text or `RELEASE_NOTES.md` — update all three when the rule syntax or version changes.

## Rule syntax (source of truth)

This table must stay in sync with the Help text in `options.html`, `docs/index.html`, and `README.md`.

| Syntax | Matches | Example |
| --- | --- | --- |
| `example.com` | Exact hostname or any subdomain | `google.com` matches `mail.google.com` |
| `*.example.com` | Wildcard subdomain (explicit) | `*.amazonaws.com` |
| `example.com/path` | Hostname + path prefix — lets one hostname split into multiple groups | `example.com/jira` vs `example.com/wiki` |
| `contains:text` | Substring anywhere in the hostname | `contains:github` |
| `regex:pattern` | Regex tested against the hostname only (not the path) | `regex:^mail\.` |

Implemented in `ruleMatchesUrl()` in `rules.js`. Groups/rules are tested in the order they exist in the stored `rules` object — the first rule that matches wins, so put more specific rules (e.g. an exact subdomain) ahead of broader ones (e.g. a bare domain) if they could otherwise conflict.

## Build & release process

1. Bump `version` in `manifest.json` (`MAJOR.MINOR.PATCH`). MINOR for new features/rule syntax, PATCH for bug fixes only, MAJOR for breaking settings changes.
2. Add a dated entry to `RELEASE_NOTES.md` under a new version heading (move the current `## Unreleased` bullets there).
3. Run `bash build.sh` — packages `manifest.json`, `background.js`, `rules.js`, `popup.html`, `popup.js`, `options.html`, `options.js`, and `icons/*.png` into `smart-tab-organizer.zip`. Requires `zip`/`unzip` on PATH.
4. Commit and push.
5. Upload `smart-tab-organizer.zip` to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) under the existing listing and submit for review.

### Troubleshooting: `zip: command not found`

`build.sh` shells out to the `zip`/`unzip` binaries, which don't ship with Windows or Git for Windows by default. Install via:

```sh
winget install --id GnuWin32.Zip
winget install --id GnuWin32.UnZip
```

Then add `C:\Program Files (x86)\GnuWin32\bin` to your PATH and open a new terminal (installers don't refresh the PATH of already-running shells).
