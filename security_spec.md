# Security Specification for Thonny IDE Cloud Workspace

## 1. Data Invariants
1. **Authentication & Verification**: Only authenticated users with `request.auth != null` and `request.auth.token.email_verified == true` may read or write their own documents.
2. **Ownership Isolation**: Every document in `/scripts/{scriptId}` and `/chats/{chatId}` must have an `ownerId` matching `request.auth.uid`. Users can never read, list, update, or delete documents owned by another UID.
3. **Strict Key & Schema Enforcement**:
   - `UserScript` (`/scripts/{scriptId}`): Required and allowed keys are `['title', 'path', 'content', 'ownerId', 'createdAt', 'updatedAt']`.
   - `ChatThread` (`/chats/{chatId}`): Required and allowed keys are `['title', 'model', 'messagesJson', 'ownerId', 'createdAt', 'updatedAt']`.
4. **Immutability & Temporal Integrity**:
   - `ownerId` and `createdAt` are immutable during `update`.
   - `createdAt` must equal `request.time` on `create`.
   - `updatedAt` must equal `request.time` on `create` and `update`.
5. **Size & Format Bounds**:
   - Document IDs must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` chars.
   - `title`: `1..120` chars.
   - `path`: `1..260` chars.
   - `content`: `0..100000` chars.
   - `model`: one of `['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite']`.
   - `messagesJson`: `0..100000` chars.

## 2. The "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Write**: Creating `/scripts/doc1` with `request.auth == null`.
2. **Unverified Email Write**: Creating `/scripts/doc1` where `request.auth.token.email_verified == false`.
3. **Identity Spoofing on Create**: Creating `/scripts/doc1` where `ownerId != request.auth.uid`.
4. **Ownership Hijack on Update**: Updating `/scripts/doc1` to change `ownerId` to another user's UID.
5. **Shadow / Ghost Field Injection on Create**: Creating `/scripts/doc1` with extra field `isAdmin: true`.
6. **Shadow Field Injection on Update**: Updating `/scripts/doc1` with an undeclared field `hacked: 'yes'`.
7. **ID Poisoning**: Creating `/scripts/invalid$id!@#` with invalid characters or length > 128.
8. **Denial-of-Wallet Oversized String**: Creating `/scripts/doc1` with `title` length > 120 characters.
9. **Timestamp Forgery on Create**: Creating `/scripts/doc1` with a client-fabricated `createdAt` != `request.time`.
10. **Immutable `createdAt` Tampering on Update**: Updating `/scripts/doc1` with a modified `createdAt` timestamp.
11. **Cross-Tenant Get/Delete**: User B attempting `get` or `delete` on `/scripts/doc1` owned by User A.
12. **Blanket List Scraping**: Executing an unconstrained `list` query on `/scripts` without `where('ownerId', '==', request.auth.uid)`.
