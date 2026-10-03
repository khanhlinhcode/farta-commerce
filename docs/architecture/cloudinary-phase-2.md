# Cloudinary lifecycle — Phase 2

Date: 2026-10-03

The Admin asks the API for a short-lived signed upload authorization. The API generates a server-controlled `farta/catalog/<uuid>` public ID and signs the exact `public_id` + `timestamp` parameters with SHA-256. The secret never enters the response.

The browser uploads directly to Cloudinary over HTTPS, then sends the provider result to `/api/v1/admin/media/finalize`. Finalization verifies Cloudinary's response signature over `public_id` and `version`, enforces the expected Cloudinary delivery host/path, image resource type, format, dimensions and configured byte limit, then persists `MediaAsset`.

This follows Cloudinary's signed-upload and response-verification contracts: [authentication signatures](https://cloudinary.com/documentation/authentication_signatures) and [response signatures](https://cloudinary.com/documentation/response_signatures), checked 2026-10-03.

Archival is two-phase. The database record is not archived while referenced by products, variants, categories or banners. Phase 2 intentionally does not call destructive provider deletion; a later idempotent cleanup worker may delete archived, unreferenced assets after a retention window.

Cloudinary configuration is complete-or-disabled. Development without credentials receives `MEDIA_PROVIDER_UNAVAILABLE`; it never reports a fake upload.
