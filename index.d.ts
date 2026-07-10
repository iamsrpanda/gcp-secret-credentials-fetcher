declare namespace accessSecretManagerKey {
    export interface AccessSecretOptions {
        /**
         * If true, returns a fallback object with undefined database credential properties
         * (hostname, ip, keyspace, username, password, etc.) if the key cannot be fetched,
         * instead of throwing an error.
         * @default false
         */
        fallbackOnError?: boolean;
    }

    /**
     * Support destructured import/require:
     * const { accessSecretManagerKey } = require('gcp-secret-credentials-fetcher');
     */
    export const accessSecretManagerKey: typeof import("./index");

    /**
     * Accesses a secret from Google Cloud Secret Manager synchronously.
     * NOTE: This blocks the event loop. Best used during one-time application bootstrap/startup.
     * 
     * @param secretKey The full name of the secret version, e.g. "projects/PROJECT_ID/secrets/SECRET_ID/versions/latest"
     * @param options Optional configuration settings
     * @returns The parsed JSON object or raw string payload.
     */
    export function accessSecretManagerKeySync(
        secretKey: string,
        options?: AccessSecretOptions
    ): any;
}

/**
 * Accesses a secret version from Google Cloud Secret Manager and returns the payload.
 * If the payload is a valid JSON string, it will be automatically parsed.
 * 
 * @param secretKey The full name of the secret version, e.g. "projects/PROJECT_ID/secrets/SECRET_ID/versions/latest"
 * @param options Optional configuration settings
 * @returns A promise resolving to the parsed JSON object or raw string payload.
 */
declare function accessSecretManagerKey(
    secretKey: string,
    options?: accessSecretManagerKey.AccessSecretOptions
): Promise<any>;

export = accessSecretManagerKey;
