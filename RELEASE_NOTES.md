# Release Notes

Use this file to record user-visible changes for each release.

## 1.1.0 - 2026-07-20

- Fix: `contains:` and `regex:` rule prefixes were documented in the Help text
  but never implemented — they now actually match as documented.
- Added: new `hostname/path` rule syntax (e.g. `example.com/jira` vs
  `example.com/wiki`) to group tabs by path, not just hostname.
- Chore: unified the previously duplicated hostname-matching logic in
  `background.js` and `popup.js` into a single shared `rules.js` module.
- Security: manually saved rule sets are now sanitized the same way as
  imported JSON, closing a gap where a typed `__proto__`/`prototype`/
  `constructor` group name could bypass validation.
- Fix: added missing viewport meta tags and moved inline styles to CSS
  classes in `options.html`/`popup.html`.
- Fix: corrected a README maintainer name typo.
- Docs: added canonical URL, Open Graph/Twitter Card tags, schema.org
  JSON-LD, `sitemap.xml`, and `robots.txt` to the documentation site.
- Fix: replaced broken nav logo and favicon references on the documentation
  site (source assets were removed from the main site).
- Docs: added a new `PLUGIN.md` with architecture, rule syntax reference,
  and the build/release process for maintainers.
- Chore: remove starter template from options UI
- Docs: add README, LICENSE, CONTRIBUTING
- Docs: published to the Chrome Web Store; added Chrome Web Store badge and
  install link to the README and documentation site
- Docs: added a GitHub Pages documentation site at `smarttab.bytebox.network`
  with real screenshots, features, install steps, rule syntax, privacy summary,
  and release notes
- Docs: adopted the shared sidebar-nav documentation template (matches other
  projects under bytebox.network) with the main site's navy/sky-blue theme
- Docs: added VJ + ByteBox logo marks as favicon and nav brand mark
- Docs: removed inconsistent button-styling from nav links; added a "Home" link
  back to the main site
- Fix: corrected `backdrop-filter` CSS property order (Safari compatibility) on
  the documentation site
- Chore: removed inline styles from the documentation page, moved to CSS classes

## 1.0.0 - 2026-06-19

- Initial public release
