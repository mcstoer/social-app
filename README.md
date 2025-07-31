# VerusSky Social App

## Development Setup

### Prerequisites

Before you begin, make sure you have the following installed:

- [Node.js 20 or higher](https://nodejs.org/en/download/)
    - For Windows users: [Node.js 20.9.0 release notes](https://nodejs.org/en/blog/release/v20.9.0)
- [Yarn package manager](https://yarnpkg.com/getting-started/install)
- The following Verus desktop wallet development environment branches (required for local development):
    - [Verus Desktop (password-manager)](https://github.com/mcstoer/Verus-Desktop/tree/password-manager)
    - [Verus Login Consent Client (password-manager)](https://github.com/mcstoer/verus-login-consent-client/tree/password-manager)

Follow their respective instructions to get the Desktop Wallet running.

### Setting up Deeplinks with the Desktop Wallet

> These steps apply only if you have set up the required Verus desktop wallet development environment branches (see Prerequisites above).

#### MacOS and Windows

Deeplinks should work out of the box when you install the Desktop Wallet on MacOS and Windows.

#### Linux

For deeplinks to work on Linux, the operating system needs to be able to associate the desktop wallet with the deeplinks. This is now supported by including the mimetype of the wallet in the desktop file when building the application.

For opening deeplinks from a browser on Linux, you need to have a desktop integration for the wallet. There are two main ways to do this:

1. Automatically creating the desktop integration using a tool like [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher).

2. Manually creating the desktop integration:

    - Starting at the folder with the AppImage, extract the desktop file from the AppImage. For example, with the Verus-Desktop-v1.2.5-x86_64 AppImage, open a terminal in the folder with the AppImage and run:
      ```bash
      ./"Verus-Desktop-v1.2.5-x86_64.AppImage" --appimage-extract
      ```
    - In the `squashfs-root` folder that was created, copy the `verus-desktop.desktop` desktop file to the `~/.local/share/applications/` folder.
    - Using a text editor, replace `AppRun` in the `Exec: AppRun --no-sandbox %U` line in the desktop file with the location of the AppImage. For example, with the Verus-Desktop-v1.2.5-x86_64 AppImage in the `/home/person/Applications/` folder, the line should be:
      ```
      Exec: /home/person/Applications/Verus-Desktop-v1.2.5-x86_64.AppImage --no-sandbox %U
      ```
    - Using the MIME type in the desktop file, register the application with the MIME type by running:
      ```bash
      xdg-mime default verus-desktop.desktop x-scheme-handler/i5jtwbp6zymeay9llnraglgjqgdrffsau4
      ```
    - Update the desktop database to recognize the desktop file by running:
      ```bash
      update-desktop-database ~/.local/share/applications/
      ```
    - There should now be a new line of `x-scheme-handler/i5jtwbp6zymeay9llnraglgjqgdrffsau4=verus-desktop.desktop;` in the `~/.local/share/applications/mimeinfo.cache` file.

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
