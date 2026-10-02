# Neir Mail

Neir Mail is the native desktop client for [Neir.io](https://neir.io). It is a fast Tauri application for Windows, macOS, and Linux covering webmail, aliases, contacts, filters, security settings, encrypted exports, and private crypto billing.

The app only signs in to existing accounts. Creating an account and recovering a lost Account Key happen on [neir.io/signup](https://neir.io/signup) and [neir.io/recovery](https://neir.io/recovery).

## Architecture

- React, TypeScript, Vite, TanStack Query, and Zustand power the interface.
- Tauri 2 and Rust own network transport, cookies, downloads, WebSocket updates, encrypted caching, notifications, and updates.
- The webview never calls the Neir API directly. A native `reqwest` client handles the same-origin cookie and CSRF boundary safely.
- Message private keys live only in process memory after local Account Key decryption.
- Cached mailbox metadata is stored in SQLite with every row sealed by AES-256-GCM under a random key held by the operating-system credential vault. Without a vault the cache is switched off.
- Files can only be attached through the native file picker; Rust refuses any other path.
- Session persistence is encrypted by the operating-system credential vault and remains revocable from Neir settings.

## Product coverage

- Account Key login, TOTP two-factor login, session restoration, local unlock, and logout
- Inbox, folders, pagination, reading, PGP body decryption, attachments, compose, drafts, scheduled delivery, undo-send, and batch actions
- Primary addresses, custom aliases, random aliases, plan status, storage use, account activity, Pro purchase, and renewal
- Preferences, contacts, filters, sessions, PGP key management, app passwords, 2FA, recovery phrase rotation, local storage, updates, export, and account deletion
- Sender icons (BIMI and favicons) on messages, pinned announcements, and the sponsored rail for free accounts
- Native desktop notifications with sound and live mailbox invalidation through the authenticated WebSocket
- Responsive resizable layouts and matching dark/light Neir visual themes

## Prerequisites

- Node.js 24 or newer
- npm 11 or newer
- Rust stable
- The platform prerequisites listed in the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)

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

Build each public artifact on its target operating system so Tauri can produce native installers and signatures. macOS releases require Developer ID signing and notarization. Windows releases should use Authenticode signing. Linux produces Debian, RPM, and AppImage bundles when their host tools are installed.

## Signed updates

The updater public key is embedded in `src-tauri/tauri.conf.json`. The corresponding private key and password must stay outside the repository and be provided only to release CI:

```bash
TAURI_SIGNING_PRIVATE_KEY_PATH=/secure/path/updater.key \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD='secret' \
npm run tauri build
```

Releases are built by the manually triggered `Release Neir Mail` GitHub Actions workflow. It validates the app, builds Linux x64, Windows x64, macOS Apple Silicon, and macOS Intel installers, creates a GitHub Release, and uploads updater signatures and `latest.json`.

The updater checks `https://github.com/marceltheking/Neirmail-Windows/releases/latest/download/latest.json` first and falls back to `https://neir.io/downloads/latest.json`.

`current-version.json`, `package.json`, and `src-tauri/tauri.conf.json` must contain the same version. Validate them with:

```bash
npm run version:check
```

Before manually running the release workflow, update all three files and commit the change. Rotating or losing the updater signing key breaks the update chain for already-installed clients.

The workflow uses ad-hoc signing for macOS so unsigned development releases open correctly. Public trusted distribution still requires Apple Developer ID notarization and Windows Authenticode secrets.

## Security model

Neir Mail does not persist plaintext Account Keys, recovery phrases, TOTP secrets, or decrypted PGP private keys. API cookies are HttpOnly-equivalent native state and requests do not cross the webview origin boundary. Downloads are streamed natively. The Content Security Policy blocks remote scripts, frames, plugins, and arbitrary network access from the interface.

Email still follows the system boundaries described in the [Privacy Policy](https://neir.io/privacy): mail routing, filtering, IMAP, SMTP, and standards-compatible Maildir storage are not zero-access unless the sender independently encrypts the message before delivery.

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).
