# Security Specification for Gita Service

## Data Invariants
1. Only authenticated admins can write to the `config` and `admins` collections.
2. Any user (authenticated or not) can read the `config/gita` and `config/gita/chunks` data to facilitate the "Wisdom" service.
3. Admin status is strictly determined by the existence of a document in `/admins/{userId}`.

## The Dirty Dozen Payloads (Red Team Test Cases)
1. **Unauthorized Upload**: An unauthenticated user tries to set `/config/gita`.
2. **Identity Spoof**: An authenticated non-admin tries to create `/admins/randomUid`.
3. **Ghost Field**: An admin tries to add `isSuperAdmin: true` to a chunk.
4. **ID Poisoning**: An admin tries to use a 1MB string as a `chunkId`.
5. **State Shortcut**: Trying to update `updatedAt` to a past date (non-server timestamp).
6. **Relational Sync**: Trying to add a chunk to a non-existent gita config.
7. **Size Attack**: Trying to upload a 2MB text chunk (exceeding Firestore 1MB limit).
8. **Type Poisoning**: Sending `embedding` as a string instead of an array.
9. **PII Leak**: Public users being able to read `/admins` collection. (Rules should block list access to `/admins`).
10. **Query Scraping**: Someone trying to list all chunks without relevant query parameters (though chunks are public here).
11. **Self-Promotion**: Authenticated user trying to write to their own `/admins/{uid}` doc.
12. **Malicious ID**: Using special characters in collection names/IDs.

## Test Runner (Simplified for Logic Verification)
Verified that:
- `get(/databases/(default)/documents/config/gita)` is ALLOWED for all.
- `create(/databases/(default)/documents/config/gita)` is DENIED for non-admins.
- `list(/databases/(default)/documents/admins)` is DENIED for all.
