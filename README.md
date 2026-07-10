# gcp-secret-credentials-fetcher

A lightweight, modern Node.js helper utility to easily retrieve, decrypt, and parse credentials and configuration payloads from Google Cloud Secret Manager.

[![npm version](https://img.shields.io/badge/npm-v1.1.0-blue.svg)](https://www.npmjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Automatic JSON Parsing**: Automatically parses the secret payload to an object if it's a valid JSON string. Otherwise, returns the raw string.
- **Pure JavaScript & Modern Async/Await**: Avoids buggy, native C++ `deasync` code loops. Ensures maximum compatibility across platforms (Docker, Alpine, Windows, macOS, Linux).
- **Synchronous Support**: Includes a `accessSecretManagerKeySync` helper for CommonJS config files (`env.js`, `config.js`) that cannot use `await`, using a zero-dependency pure-JS approach via `child_process.spawnSync`.
- **Lazy Initialization**: The GCP Client is initialized only when requested, ensuring your app doesn't crash on boot if secrets aren't accessed in that environment.
- **Error Fallback Mode**: Offers optional legacy-compatible fallback mode, returning a database configuration object with `undefined` properties instead of throwing an error.

---

## Installation

```bash
npm install gcp-secret-credentials-fetcher
```

*Note: Requires Node.js version 18.0.0 or higher.*

---

## Google Cloud Credentials Setup

This package uses the official Google Cloud Secret Manager client under the hood, which automatically authenticates using Application Default Credentials (ADC).

### 1. Local Development (Service Account Key)
1. In the Google Cloud Console, create a Service Account and grant it the **Secret Manager Secret Accessor** role (`roles/secretmanager.secretAccessor`).
2. Download the JSON key file.
3. Set the environment variable:
   - **Windows (PowerShell)**: `$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account-key.json"`
   - **Linux/macOS**: `export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"`

### 2. Cloud Environment (GCP VM, GKE, Cloud Run, Cloud Functions)
No key file is required. Assign a service account with the **Secret Manager Secret Accessor** role directly to your Compute instance, GKE pod, or Cloud Run service. The library will authenticate automatically.

---

## Choosing the Right Function

This package exposes **two functions** for two different situations — both do the same thing (fetch a secret) but in fundamentally different ways:

| | `getSecret` / `accessSecretManagerKey` | `accessSecretManagerKeySync` |
|---|---|---|
| **Returns** | `Promise<any>` | `any` (directly) |
| **Needs `await`?** | ✅ Yes | ❌ No |
| **Blocks event loop?** | ❌ No | ✅ Yes (briefly, once at startup) |
| **Best for** | App startup, service handlers | Config files, `env.js` |
| **Solves** | General async use | `ERR_REQUIRE_ASYNC_MODULE` error |

> **Why does `ERR_REQUIRE_ASYNC_MODULE` happen?**  
> When you use `await` at the top level of a file loaded via `require()`, Node.js treats it as an async ESM module and throws this error. `accessSecretManagerKeySync` solves this by removing the need for `await` entirely — the result is returned directly.

---

## Usage Examples

### 1. Recommended: Asynchronous Initialization (Async/Await)
For standard Node.js applications, fetch the credentials asynchronously at startup before starting your services:

```javascript
const getSecret = require('gcp-secret-credentials-fetcher');

async function initializeApp() {
    try {
        const secretKeyPath = process.env.cassandra_secret_key; // e.g. "projects/123456789/secrets/cassandra-config/versions/latest"
        
        // Fetches and automatically parses the JSON secret payload
        const cassandraCredentials = await getSecret(secretKeyPath);
        
        console.log("Secret loaded successfully. Connecting to database...");
        console.log("Host:", cassandraCredentials.hostname);
        
        // Start your server/db clients here using the credentials
    } catch (error) {
        console.error("Failed to load application configurations:", error.message);
        process.exit(1);
    }
}

initializeApp();
```

### 2. Modern Node.js: Top-Level Await (ES Modules)
If your package is configured as an ES module (`"type": "module"` in your `package.json`), or you are running in a supported Node.js environment, you can use top-level await:

```javascript
import getSecret from 'gcp-secret-credentials-fetcher';

const secretKeyPath = process.env.cassandra_secret_key;
const credentials = await getSecret(secretKeyPath);

export default credentials;
```

### 3. Legacy Migration / Fallback Mode
If your existing application has a legacy setup that expects an object with empty database fields on error instead of throwing a validation/network exception, pass the `{ fallbackOnError: true }` option:

```javascript
const getSecret = require('gcp-secret-credentials-fetcher');

async function getDbConfig() {
    // If the call fails, this will NOT throw, but instead return:
    // { hostname: undefined, ip: undefined, username: undefined, password: undefined, ... }
    const credentials = await getSecret(
        process.env.cassandra_secret_key, 
        { fallbackOnError: true }
    );
    
    return credentials;
}
```

### 4. Synchronous — For Config Files (`env.js` / `config.js`)
Use this when you are loading secrets inside a CommonJS configuration file using `require()`, where using `await` at the top level would cause a `ERR_REQUIRE_ASYNC_MODULE` error:

```javascript
const { accessSecretManagerKeySync } = require('gcp-secret-credentials-fetcher');

// No async, no await — result is returned directly!
const cassandraConfig = accessSecretManagerKeySync(process.env.cassandra_secret_key);

module.exports = cassandraConfig;
```

With fallback on error:
```javascript
const { accessSecretManagerKeySync } = require('gcp-secret-credentials-fetcher');

const cassandraConfig = accessSecretManagerKeySync(
    process.env.cassandra_secret_key,
    { fallbackOnError: true } // returns { hostname: undefined, ... } instead of throwing
);

module.exports = cassandraConfig;
```

---

## API Reference

### `getSecret(secretKey, [options])` / `accessSecretManagerKey(secretKey, [options])` — Async

Returns a `Promise` resolving to the payload. Must be used with `await` inside an `async` function.

#### Parameters:
- **`secretKey`** (`string`, Required): The full resource name of the secret version in Google Cloud, e.g. `projects/PROJECT_NUMBER/secrets/SECRET_NAME/versions/latest` or `projects/PROJECT_NUMBER/secrets/SECRET_NAME/versions/1`.
- **`options`** (`Object`, Optional):
  - **`fallbackOnError`** (`boolean`, Optional): If `true`, returns a fallback database object with empty (`undefined`) properties on failure instead of throwing an error. Defaults to `false`.

#### Returns:
- **`Promise<any>`**: Resolves to the parsed JSON object if the payload is valid JSON, or the raw UTF-8 string/payload if parsing fails.

---

### `accessSecretManagerKeySync(secretKey, [options])` — Synchronous

Blocks execution and returns the secret payload **directly** — no `await` required. Internally spawns a short-lived child Node.js process via `child_process.spawnSync`. Best used in CommonJS configuration files.

#### Parameters:
- **`secretKey`** (`string`, Required): The full resource name of the secret version in Google Cloud, e.g. `projects/PROJECT_NUMBER/secrets/SECRET_NAME/versions/latest`.
- **`options`** (`Object`, Optional):
  - **`fallbackOnError`** (`boolean`, Optional): If `true`, returns a fallback database object with empty (`undefined`) properties on failure instead of throwing an error. Defaults to `false`.

#### Returns:
- **`any`**: The parsed JSON object if the payload is valid JSON, or the raw UTF-8 string.

---

## License

MIT © 2026
