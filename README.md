<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/banner_v2_dark.png">
  <source media="(prefers-color-scheme: light)" srcset="public/banner_v2.png">
  <img src="public/banner_v2.png" alt="Neir Mail" width="640">
</picture>

### The native desktop client for [Neir.io](https://neir.io)

Fast, private, and secure email for Windows, macOS, and Linux.

[![Release](https://img.shields.io/github/v/release/marceltheking/Neirmail-Windows?color=2f6b41&label=release)](https://github.com/marceltheking/Neirmail-Windows/releases/latest)
[![License](https://img.shields.io/badge/license-AGPL--3.0-2f6b41.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-2f6b41.svg)](#prerequisites)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-2f6b41.svg)](https://v2.tauri.app)

[Download](https://github.com/marceltheking/Neirmail-Windows/releases/latest) ·
[Create an account](https://neir.io/signup) ·
[Recover a key](https://neir.io/recovery) ·
[Privacy Policy](https://neir.io/privacy)

</div>

---

Neir Mail wraps the full Neir webmail experience in a native application: inbox and folders, aliases, contacts, filters, security settings, encrypted exports, and private crypto billing. The interface is a React webview, while all network, storage, and secret handling run in a native Rust core.

The app signs in to existing accounts only. Creating an account or recovering a lost Account Key happens on the web at [neir.io/signup](https://neir.io/signup) and [neir.io/recovery](https://neir.io/recovery).

## Features

| Area | What you get |
| --- | --- |
| **Authentication** | Account Key login, TOTP two-factor, session restore, local unlock, logout |
| **Mail** | Inbox, folders, pagination, PGP body decryption, attachments, compose, drafts, scheduled send, undo send, batch actions |
| **Identity** | Primary addresses, custom and random aliases, plan status, storage use, account activity |
| **Account** | Preferences, contacts, filters, sessions, PGP keys, app passwords, 2FA, recovery-phrase rotation, export, deletion |
| **Experience** | Sender icons (BIMI and favicons), pinned announcements, native notifications with sound, live mailbox updates |
| **Design** | Responsive resizable layouts with matching dark and light Neir themes |
| **Billing** | In-app Pro purchase and renewal through private crypto billing |

## Architecture

- **Frontend:** React, TypeScript, Vite, TanStack Query, and Zustand.
- **Core:** Tauri 2 and Rust own network transport, cookies, downloads, WebSocket updates, encrypted caching, notifications, and updates.
- **Boundary:** the webview never calls the Neir API directly. A native `reqwest` client handles the same-origin cookie and CSRF boundary safely.
- **Keys:** message private keys live only in process memory after local Account Key decryption.
- **Cache:** mailbox metadata is stored in SQLite with every row sealed by AES-256-GCM, under a random key held by the operating-system credential vault. Without a vault, the cache is disabled.
- **Files:** attachments can only be added through the native file picker. Rust refuses any other path.
- **Sessions:** session persistence is encrypted by the credential vault and stays revocable from Neir settings.

## Security model

Neir Mail does not persist plaintext Account Keys, recovery phrases, TOTP secrets, or decrypted PGP private keys. API cookies are HttpOnly-equivalent native state, and requests do not cross the webview origin boundary. Downloads are streamed natively. The Content Security Policy blocks remote scripts, frames, plugins, and arbitrary network access from the interface.

Email still follows the system boundaries described in the [Privacy Policy](https://neir.io/privacy): mail routing, filtering, IMAP, SMTP, and standards-compatible Maildir storage are not zero-access unless the sender independently encrypts the message before delivery.

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 24 or newer |
| npm | 11 or newer |
| Rust | stable |
| Platform tools | per the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/) |

## Development

```bash
npm install
npm run tauri dev
```

Production is the default API target. Point a development build at another Neir backend with:

```bash
NEIRMAIL_API_BASE_URL=http://127.0.0.1:3099 npm run tauri dev
```

The backend must expose the same REST and WebSocket contract as `https://neir.io`. Release builds ignore this variable unless it points at an `https://` or `.onion` address, so plain-HTTP backends work in development builds only.

## Quality checks

```bash
npm run check
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

## Building installers

```bash
npm run tauri build
```

Build each public artifact on its target operating system so Tauri can produce native installers and signatures:

- **macOS** releases require Developer ID signing and notarization.
- **Windows** releases should use Authenticode signing.
- **Linux** produces Debian, RPM, and AppImage bundles when their host tools are installed.

## Signed updates

The updater public key is embedded in `src-tauri/tauri.conf.json`. The matching private key and password must stay outside the repository and be provided only to release CI:

```bash
TAURI_SIGNING_PRIVATE_KEY_PATH=/secure/path/updater.key \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD='secret' \
npm run tauri build
```

Releases are built by the manually triggered `Release Neir Mail` GitHub Actions workflow. It validates the app, builds Linux x64, Windows x64, macOS Apple Silicon, and macOS Intel installers, creates a GitHub Release, and uploads updater signatures and `latest.json`.

The updater checks `https://github.com/marceltheking/Neirmail-Windows/releases/latest/download/latest.json` first and falls back to `https://neir.io/downloads/latest.json`.

`current-version.json`, `package.json`, and `src-tauri/tauri.conf.json` must share the same version. Validate them with:

```bash
npm run version:check
```

Before running the release workflow, update all three files and commit the change. Rotating or losing the updater signing key breaks the update chain for already-installed clients. The workflow uses ad-hoc signing for macOS so unsigned development releases open correctly. Public trusted distribution still requires Apple Developer ID notarization and Windows Authenticode secrets.

## License

Licensed under [AGPL-3.0-or-later](LICENSE).

<div align="center">

Made for [Neir.io](https://neir.io)

</div>
