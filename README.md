# Smart Tab Organizer

Smart Tab Organizer groups browser tabs by hostname using user-defined rule sets.

[![Available in the Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/smart-tab-organizer/pgkddgeelhiccjleihfndofdibmjcopj)

📖 **[Full documentation site →](https://smarttab.bytebox.network)**

## About this repo

This repository contains a lightweight Chrome extension that automatically groups related tabs by hostname, keeps workflows organized with named rule sets, and gives you quick popup controls for organizing, reordering, grouping, and ungrouping tabs.

## Features

- Named rule sets for multiple workflows
- Sync settings across devices (opt-in)
- Live color preview and ordered groups
- Popup actions: organize, reorder, group, ungroup, cleanup
- Optional unmatched-group fallback and ignore-pinned option

## Install

**Easiest way:** install directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/smart-tab-organizer/pgkddgeelhiccjleihfndofdibmjcopj).

**Or load unpacked (for development/testing):**

1. Open `chrome://extensions/` (or `edge://extensions/`).
2. Enable *Developer mode*.
3. Click **Load unpacked** and select this repository folder (`tab-organizer`).
4. Open the extension's options page via the extensions menu and configure rule sets.

## Options

Open the options page to create named rule sets, add groups (one group per row), and enter rules (one per line). Use `contains:`, `*.domain` wildcards, or `regex:` prefixes for advanced matching.

## Developer notes

- Manifest: `manifest.json` (MV3)
- Background service worker: `background.js`
- Options UI: `options.html`, `options.js`
- Popup: `popup.html`, `popup.js`

## Author & Contact

Maintained by Vivek Janrukiya

## License

This project is available under the terms of the MIT license — see `LICENSE`.

## Contributing

See `CONTRIBUTING.md` for contribution guidelines and local testing steps.

## Release notes

See `RELEASE_NOTES.md` for user-visible changelog and release history.
