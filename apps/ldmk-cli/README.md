# Ledger Device Management Kit CLI

Interactive command-line interface for the [Ledger Device Management Kit](https://github.com/LedgerHQ/device-sdk-ts) (DMK). Use it to discover, connect to, and interact with Ledger devices from your terminal.

## Overview

The CLI provides a menu-driven workflow to:

- **Device management** — List Ledger devices, connect/disconnect
- **Device actions** — Open apps, list installed apps, go to dashboard
- **Low-level** — Send raw APDUs or structured device commands (OS version, battery, app info, etc.)
- **Signing** — Use the Ethereum signer for address derivation, message/transaction/typed-data signing, and Safe address verification

It uses `@ledgerhq/device-transport-kit-node-hid` transport kit and connects to the DMK DevTools for debugging.

## Prerequisites

- Node.js
- [proto](https://moonrepo.dev/docs/proto/install) and [pnpm](https://pnpm.io/) (see root [README](../../README.md))
- Dependencies installed from the **monorepo root**: `pnpm i`
- A Ledger device with USB support (for device commands)

## Dependencies

Key dependencies (workspace packages are from this monorepo):

| Package                                           | Purpose                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `@ledgerhq/device-management-kit`                 | Core DMK API: device discovery, connection, actions                      |
| `@ledgerhq/device-transport-kit-node-hid`         | USB HID transport for Ledger devices                                     |
| `@ledgerhq/device-signer-kit-ethereum`            | Ethereum app: address derivation, message/transaction/typed-data signing |
| `@ledgerhq/device-management-kit-devtools-*`      | DevTools logging and WebSocket connector (when using `pnpm dev`)         |
| `@ledgerhq/context-module`, `@ledgerhq/ldmk-tool` | Shared DMK utilities                                                     |

## Running the CLI

From the **repository root**:

```bash
pnpm cli dev
```

## Main commands

| Command                      | Description                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| **List devices**             | Discover available Ledger devices                                                                         |
| **Connect** / **Disconnect** | Connect to or disconnect from a selected device                                                           |
| **Send APDU**                | Send a raw APDU to the device                                                                             |
| **Send command**             | Run a device command: get OS version, app version, battery status, list/open/close apps                   |
| **Execute device action**    | Run high-level actions: device status, go to dashboard, open app, list apps, device metadata              |
| **Use signer**               | Use the Ethereum signer: get address, verify Safe address, sign message/transaction/typed data/delegation |
| **Exit**                     | Quit the CLI                                                                                              |

Available options depend on whether a device is connected; the menu updates accordingly.

## Project structure

```
apps/ldmk-cli/
├── index.ts                 # Entry point, bootstraps DI and runs FrontController
├── app/
│   ├── di/                  # Inversify module and types
│   ├── FrontController.ts   # Main loop: device listener, prompt, action dispatch
│   ├── state/               # App state (discovered devices, connection)
│   ├── handlers/            # Action handlers (one per user-facing command)
│   │   ├── device/          # List, connect, disconnect
│   │   ├── apdu/            # Send raw APDU
│   │   ├── device-command/  # Send device commands (OS version, apps, etc.)
│   │   ├── device-action/   # High-level device actions
│   │   ├── signer/          # Signer selection and Eth signer sub-actions
│   │   └── cli/             # Exit
│   └── utils/
└── package.json
```
