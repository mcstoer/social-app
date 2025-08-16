# VerusSky Social App

## Development Setup

### Prerequisites

Before you begin, make sure you have the following installed:

- [Node.js 20 or higher](https://nodejs.org/en/download/)
    - For Windows users: [Node.js 20.9.0 release notes](https://nodejs.org/en/blog/release/v20.9.0)
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
    VERUS_RPC_SERVER
    ```

3. Variables you **must** set:
    - `EXPO_PUBLIC_IADDRESS`: The i-address that is signing the responses.
    - `VERUS_RPC_USERNAME`: The username for accessing the Verus JSON rpc server.
    - `VERUS_RPC_PASSWORD`: The password for accessing the Verus JSON rpc server.

    The `VERUS_RPC_USERNAME` and `VERUS_RPC_PASSWORD` can be found in the Verus wallet configuration file:
    - **Linux:** `~/.komodo/vrsctest/vrsctest.conf`
    - **macOS:** To be added.
    - **Windows:** `%APPDATA%\Komodo\vrsctest\vrsctest.conf`

## Running VerusSky Web App

To install all required dependencies, run:
```bash
yarn dev:setup
```

To start the development servers, run:
```bash
yarn dev:run
```

Once the servers are running, you can access the web app at `http://localhost:19006`.
