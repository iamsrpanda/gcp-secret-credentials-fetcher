const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { spawnSync } = require('child_process');

// Instantiate client lazily so that it does not crash on import if credentials are missing.
let client;

function getClient() {
    if (!client) {
        client = new SecretManagerServiceClient();
    }
    return client;
}

/**
 * Accesses a secret from Google Cloud Secret Manager.
 * 
 * @param {string} secretKey - The full resource name of the secret version, e.g. "projects/PROJECT_ID/secrets/SECRET_ID/versions/latest"
 * @param {Object} [options] - Optional configurations
 * @param {boolean} [options.fallbackOnError=false] - If true, returns an object with default properties if the key cannot be fetched, rather than throwing an error.
 * @returns {Promise<any>} The parsed JSON secret payload, or the raw string if not valid JSON.
 */
async function accessSecretManagerKey(secretKey, options = {}) {
    if (!secretKey) {
        throw new Error("GCP Secret Manager: secretKey argument is required.");
    }

    try {
        const clientInstance = getClient();
        const [response] = await clientInstance.accessSecretVersion({
            name: secretKey,
        });

        if (!response.payload || !response.payload.data) {
            throw new Error(`Secret response from GCP did not contain payload data for key: ${secretKey}`);
        }

        const payloadStr = response.payload.data.toString('utf8');

        try {
            // Attempt to parse as JSON, otherwise return the raw string
            return JSON.parse(payloadStr);
        } catch {
            return payloadStr;
        }
    } catch (err) {
        console.error("accessSecretManagerKeyError ==>", err.message);

        if (options.fallbackOnError) {
            // Replicate the original behavior of returning empty fields if explicitly requested
            return {
                hostname: undefined,
                ip: undefined,
                ip1: undefined,
                ip2: undefined,
                ip3: undefined,
                keyspace: undefined,
                username: undefined,
                password: undefined
            };
        }

        throw err;
    }
}

/**
 * Accesses a secret from Google Cloud Secret Manager synchronously.
 * NOTE: This blocks the event loop. Best used during one-time application bootstrap/startup.
 * 
 * @param {string} secretKey - The full resource name of the secret version, e.g. "projects/PROJECT_ID/secrets/SECRET_ID/versions/latest"
 * @param {Object} [options] - Optional configurations
 * @param {boolean} [options.fallbackOnError=false] - If true, returns an object with default properties if the key cannot be fetched, rather than throwing an error.
 * @returns {any} The parsed JSON secret payload, or the raw string if not valid JSON.
 */
function accessSecretManagerKeySync(secretKey, options = {}) {
    if (!secretKey) {
        throw new Error("GCP Secret Manager: secretKey argument is required.");
    }

    // Node script to run in a separate sync process
    const script = `
        const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
        const client = new SecretManagerServiceClient();
        client.accessSecretVersion({ name: ${JSON.stringify(secretKey)} })
            .then(([res]) => {
                process.stdout.write(res.payload.data.toString('utf8'));
                process.exit(0);
            })
            .catch(err => {
                process.stderr.write(err.message);
                process.exit(1);
            });
    `;

    const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });

    if (result.status !== 0) {
        const errMsg = result.stderr || 'Unknown error fetching secret synchronously';
        console.error("accessSecretManagerKeySyncError ==>", errMsg);

        if (options.fallbackOnError) {
            return {
                hostname: undefined,
                ip: undefined,
                ip1: undefined,
                ip2: undefined,
                ip3: undefined,
                keyspace: undefined,
                username: undefined,
                password: undefined
            };
        }

        throw new Error(errMsg);
    }

    const payloadStr = result.stdout;

    try {
        return JSON.parse(payloadStr);
    } catch {
        return payloadStr;
    }
}

// Set default export (for direct require)
module.exports = accessSecretManagerKey;

// Support destructured require and ES Module defaults
module.exports.accessSecretManagerKey = accessSecretManagerKey;
module.exports.accessSecretManagerKeySync = accessSecretManagerKeySync;
module.exports.default = accessSecretManagerKey;
