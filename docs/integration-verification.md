# Integration verification and test data

## Safe authenticated test accounts

Test-account scripts only accept a dedicated MongoDB Atlas database whose database name ends in `_test`. They also require `NODE_ENV=development` and `ALLOW_TEST_DATA_SEEDING=true`. They do not use the application's ordinary `MONGODB_URI` for writes: each script takes `TEST_MONGODB_URI` and validates its database name before connecting.

Set the following in the ignored `server/.env` for a disposable test Atlas database:

```dotenv
TEST_MONGODB_URI=mongodb+srv://.../smartqueue_integration_test
ALLOW_TEST_DATA_SEEDING=true
TEST_ADMIN_FULL_NAME=Integration Test Admin
TEST_ADMIN_EMAIL=admin-test@example.invalid
TEST_ADMIN_PHONE=+919000000101
TEST_ADMIN_PASSWORD=<unique-strong-development-password>
TEST_CITIZEN_FULL_NAME=Integration Test Citizen
TEST_CITIZEN_EMAIL=citizen-test@example.invalid
TEST_CITIZEN_PHONE=+919000000102
TEST_CITIZEN_PASSWORD=<unique-strong-development-password>
```

Keep all credentials in the ignored local file or a secret manager; never paste them into chat or commit them. `npm run test-accounts:seed` is append-only: it skips already marked test accounts and refuses to modify an account with a conflicting email or phone. The citizen account is pre-verified for development workflow testing. Admin provisioning uses `AuthService.provisionAdmin`; public admin registration remains unavailable.

After testing, run `npm run test-accounts:remove`. Cleanup only targets accounts marked `testAccount` in the same isolated `_test` database and deletes their test-owned tokens, appointments, document metadata, notifications, and audit entries. It releases only counters serving tokens owned by those test accounts. Do not point these scripts at a production or shared database.

The existing `npm run admin:provision` uses `ADMIN_FULL_NAME`, `ADMIN_EMAIL`, `ADMIN_PHONE`, and `ADMIN_PASSWORD` in `server/.env` and operates on `MONGODB_URI`. Use it only against the intended admin database; for end-to-end test work, use the guarded test-account scripts above.

## Document uploads

No document storage provider or upload transport is configured. The current API persists document metadata only. Browser-selected files and image previews are temporary and are not retrieved after reload; do not treat them as uploaded or permanent.

For a future private S3-compatible implementation, configure these server-only values after adding and reviewing a storage adapter:

- `STORAGE_PROVIDER=s3`
- `STORAGE_BUCKET`
- `STORAGE_REGION`
- `STORAGE_ENDPOINT` (optional for AWS; required for a compatible non-AWS endpoint)
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- `STORAGE_PRESIGNED_URL_TTL_SECONDS`
- `STORAGE_MAX_FILE_BYTES`

These variables are documentation for a future adapter and are not currently read by the application. The bucket should remain private; downloads should use short-lived signed URLs after ownership checks. Credentials must stay in `server/.env` or a secret manager.

## Integration limitations

- Email/OTP delivery is not configured. Development verification codes can only be shown when the explicit development-only `AUTH_OTP_EXPOSE=true` option is enabled.
- Admin email changes are not supported because no verified-email change flow exists. Admin name and phone number can be updated.
- Admin profile images remain local previews until private file storage is implemented.
- The counter API supports counter CRUD, department assignment, and availability. Manual counter assignment/release is performed by token lifecycle operations rather than a separate counter action.
- Public statistics are database aggregates only. No individual identity, token identifier, or contact field is returned. If the public endpoint is unavailable, the statistics page falls back to explicitly labeled illustrative demo data.
