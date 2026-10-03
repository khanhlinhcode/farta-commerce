# ADR-007: Cloudinary media architecture

Status: Accepted

Use short-lived server-authorized signed uploads and a verified finalize step. Store complete provider identity/metadata, validate content policy, audit actions and perform reference-aware two-phase deletion. No Cloudinary secret enters a frontend bundle.
