const test = require('node:test');
const assert = require('node:assert');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const accessSecretManagerKey = require('./index');
const { accessSecretManagerKey: namedExport } = require('./index');

// Force instant credential load failure to prevent slow GCP metadata server network timeouts in tests
process.env.GOOGLE_APPLICATION_CREDENTIALS = 'non-existent-file.json';

test('GCP Secret Manager Helper Tests', async (t) => {
    // Save original prototype method
    const originalAccess = SecretManagerServiceClient.prototype.accessSecretVersion;

    t.afterEach(() => {
        SecretManagerServiceClient.prototype.accessSecretVersion = originalAccess;
    });

    await t.test('should support both default and named exports', () => {
        assert.strictEqual(accessSecretManagerKey, namedExport);
    });

    await t.test('should throw error if secretKey is not provided', async () => {
        await assert.rejects(
            async () => {
                await accessSecretManagerKey();
            },
            /secretKey argument is required/
        );
    });

    await t.test('should return parsed JSON on success', async () => {
        const mockPayload = {
            hostname: 'localhost',
            username: 'admin',
            password: 'password123'
        };

        SecretManagerServiceClient.prototype.accessSecretVersion = async (args) => {
            assert.strictEqual(args.name, 'projects/123/secrets/my-secret/versions/latest');
            return [{
                payload: {
                    data: Buffer.from(JSON.stringify(mockPayload))
                }
            }];
        };

        const result = await accessSecretManagerKey('projects/123/secrets/my-secret/versions/latest');
        assert.deepStrictEqual(result, mockPayload);
    });

    await t.test('should return raw string if not JSON', async () => {
        const rawString = 'my-plain-text-secret';

        SecretManagerServiceClient.prototype.accessSecretVersion = async () => {
            return [{
                payload: {
                    data: Buffer.from(rawString)
                }
            }];
        };

        const result = await accessSecretManagerKey('some-key');
        assert.strictEqual(result, rawString);
    });

    await t.test('should throw error if access fails', async () => {
        SecretManagerServiceClient.prototype.accessSecretVersion = async () => {
            throw new Error('Permission denied');
        };

        await assert.rejects(
            async () => {
                await accessSecretManagerKey('some-key');
            },
            /Permission denied/
        );
    });

    await t.test('should return fallback object on failure if fallbackOnError is true', async () => {
        SecretManagerServiceClient.prototype.accessSecretVersion = async () => {
            throw new Error('API connection timed out');
        };

        const result = await accessSecretManagerKey('some-key', { fallbackOnError: true });

        assert.deepStrictEqual(result, {
            hostname: undefined,
            ip: undefined,
            ip1: undefined,
            ip2: undefined,
            ip3: undefined,
            keyspace: undefined,
            username: undefined,
            password: undefined
        });
    });

    await t.test('accessSecretManagerKeySync should throw validation error if secretKey is missing', () => {
        assert.throws(
            () => {
                accessSecretManagerKey.accessSecretManagerKeySync();
            },
            /secretKey argument is required/
        );
    });

    await t.test('accessSecretManagerKeySync should throw error when GCP connection fails (no credentials)', () => {
        assert.throws(
            () => {
                accessSecretManagerKey.accessSecretManagerKeySync('projects/123/secrets/my-secret/versions/latest');
            },
            /Could not load the default credentials|credential|enoent|no such file/i
        );
    });

    await t.test('accessSecretManagerKeySync should return fallback credentials object on GCP failure when fallbackOnError is true', () => {
        const result = accessSecretManagerKey.accessSecretManagerKeySync('projects/123/secrets/my-secret/versions/latest', { fallbackOnError: true });

        assert.deepStrictEqual(result, {
            hostname: undefined,
            ip: undefined,
            ip1: undefined,
            ip2: undefined,
            ip3: undefined,
            keyspace: undefined,
            username: undefined,
            password: undefined
        });
    });
});
