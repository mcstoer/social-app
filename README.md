# VerusSky Social App

## Development Setup

### Prerequisites

Before you begin, make sure you have the following installed:

- [Node.js 20.19.4 or higher](https://nodejs.org/en/download/)
    - Node.js 22 does **not** work
    - Node.js 20.19.5 (LTS) is recommended
    - For Windows users: [Node.js 20.19.5 download](https://nodejs.org/en/download/archive/v20.19.5)
- [Yarn package manager](https://yarnpkg.com/getting-started/install)
- The following Verus Desktop Wallet development environment branches (required for local development):
    - [Verus Desktop (password-manager)](https://github.com/mcstoer/Verus-Desktop/tree/password-manager)
    - [Verus Login Consent Client (password-manager)](https://github.com/mcstoer/verus-login-consent-client/tree/password-manager)

Follow their respective instructions to get the Verus Desktop Wallet running.

### Setting up Deeplinks with the Verus Desktop Wallet

> This only applies if you have set up the required Verus Desktop Wallet development environment branches (see Prerequisites above).

Deeplinks should work out of the box when you install the Verus Desktop Wallet on MacOS and Windows, or run a production build of the Verus Desktop Wallet on Linux.

### Environment Variables

1. Create a `.env` file using `.env.example` as a template.

2. Variables you can leave as-is:
    ```
    BITDRIFT_API_KEY
    SENTRY_AUTH_TOKEN
    EXPO_PUBLIC_LOG_LEVEL
    EXPO_PUBLIC_LOG_DEBUG
    EXPO_PUBLIC_BUNDLE_IDENTIFIER
    EXPO_PUBLIC_BUNDLE_DATE

    DEFAULT_CHAIN
    DEFAULT_URL
    ```

3. Variables you **must** set:
    - `EXPO_PUBLIC_IADDRESS`: The i-address that is signing the responses. This can be a name in the format of "Name@".

## Running the VerusSky Web App 

First install all required dependencies:
```bash
yarn dev:setup
```

### Development Mode

Start the development servers:
```bash
yarn dev:run
```

Once the servers are running, you can access the web app at `http://localhost:19006`.

### Production Mode

Extract and compile the lingui translations:
```bash
yarn intl:build
```

To build the SPA bundle:
```bash
yarn build-web
```

Follow the instructions in the [bskyweb README](/bskyweb/README.md) to run the golang daemon.

In `vskysigningserver` directory, start the signing server:
```bash
yarn dev
```

Once the servers are running, you can access the web app at `http://localhost:8100`.

### Configuration

The VerusSky app uses a configuration file that is stored in the following directory depending on your operating system.

| Operating System | Directory                                 |
|------------------|-------------------------------------------|
| Linux            | `~/.verussky/`                            |
| macOS            | `~/Library/Application Support/VerusSky/` |
| Windows          | `%APPDATA%\VerusSky\`                     |

Each time ater updating the configuration file you must run:
```bash
yarn dev:setup
```