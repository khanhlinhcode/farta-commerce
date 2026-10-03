# Cloudinary and media lifecycle

## Upload approach

Default: authenticated server-issued signed direct upload for large media, followed by a finalize call to the API. The API never exposes the Cloudinary API secret.

1. Authorized operator requests an upload intent with declared resource type/size/dimensions.
2. API validates permission, limits and folder/public-ID policy and returns short-lived scoped signing data.
3. Browser uploads directly to Cloudinary.
4. Browser submits provider result to finalize.
5. API verifies signature/result metadata and creates `MediaAsset` in `PENDING_REVIEW` or `ACTIVE` according to policy.

Customer upload, remote-fetch upload and SVG are disabled until separate reviewed policies exist.

## MediaAsset

`publicId`, `version`, `secureUrl`, `resourceType`, `format`, width, height, bytes, checksum/provider signature metadata where available, status, `createdBy`, timestamps.

The application stores provider identity and metadata, not URL alone. Delivery URLs are constructed/validated from trusted provider metadata and allowlisted transformations.

## Validation

- allowlisted actual format/MIME and resource type;
- size, pixel dimensions and count limits;
- server-controlled public ID/folder;
- no caller-controlled transformation capable of active content;
- image decode/re-encode or provider transformation where practical;
- safe filename used only as display metadata.

## Reference and deletion

Products, variants and banners reference `MediaAsset` IDs. Delete is two-phase: mark `DELETE_PENDING`, verify zero live references, delete provider asset idempotently, then mark `DELETED`. Failures are retried and audited; the database never claims deletion before provider confirmation.
