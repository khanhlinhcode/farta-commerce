# API conventions

- Base path: `/api/v1`.
- JSON uses UTF-8 and camelCase fields.
- Unsafe idempotent workflows accept `Idempotency-Key`; ambiguous duplicates are rejected.
- Pagination is bounded and cursor-based by default.
- Authentication, rate-limit and CSRF requirements are documented per operation when those operations are implemented.

Error envelope:

```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid credentials.",
    "requestId": "019..."
  }
}
```

Stack traces, database/provider errors, paths and secret values are never public response fields.
