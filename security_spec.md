# Meet Boston CMS — Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default Deny**: All unmatched Firestore paths are strictly denied (`allow read, write: if false`).
2. **Verified Admin Governance**: Only verified CMS admins (`request.auth.token.email_verified == true` AND either bootstrapped owner `duyweb5@gmail.com` or an existing record in `/admins/{uid}`) may create, update, or delete CMS content (`siteConfig`, `experiences`, `neighborhoods`, `events`, `hotels`) or read/manage private lead PII (`guideLeads`, `meetingRfps`).
3. **Public Visibility Gate**: Unauthenticated and non-admin visitors may only read (`get` / `list`) documents in `experiences`, `neighborhoods`, `events`, and `hotels` where `published == true`, plus `siteConfig/main`. Draft or unpublished items (`published == false`) are strictly invisible to non-admins.
4. **Strict PII Isolation**: `guideLeads` and `meetingRfps` contain visitor email addresses and organization notes. Public visitors may ONLY `create` a new lead with `status == 'new'`, valid email format, strict field key allowlist, bounded string sizes, and server timestamp (`createdAt == request.time && updatedAt == request.time`). Public visitors can NEVER `get`, `list`, `update`, or `delete` any lead document.
5. **Identity & Temporal Integrity**:
   - Every CMS write enforces `createdBy == request.auth.uid` on create and `createdBy == existing().createdBy` + `createdAt == existing().createdAt` (immutable) on update.
   - `createdAt == request.time` on create; `updatedAt == request.time` on update.
6. **Path ID & Volumetric Guard**: All single-document `get`, `create`, `update`, `delete` operations enforce `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars). Every string and array enforces explicit `.size()` bounds.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated CMS Write**: Anonymous user attempts `create` on `/experiences/exp-hack` with valid fields → DENIED (`!isAdmin()`).
2. **Unverified Admin Email Spoof**: User with `email: "duyweb5@gmail.com"` and `email_verified: false` attempts `update` on `/siteConfig/main` → DENIED (`email_verified == true` required).
3. **Self-Assigned Admin Escalation**: Non-admin signed-in user attempts `create` on `/admins/{ownUid}` with `role: "admin"` → DENIED (only existing admin can manage `/admins`).
4. **Shadow Field Injection on Lead Create**: Public visitor submits `/guideLeads/lead-1` with extra ghost field `isVerified: true` → DENIED (`keys().hasOnly(...)`).
5. **Status Shortcutting on Lead Create**: Public visitor submits `/meetingRfps/rfp-1` with `status: "responded"` instead of `"new"` → DENIED (`data.status == 'new'`).
6. **PII Read Leak on Leads**: Signed-in non-admin user attempts `get` or `list` on `/guideLeads` or `/meetingRfps` → DENIED (PII restricted strictly to admins).
7. **Unpublished Draft Scraping**: Public visitor attempts `get` on `/experiences/draft-1` where `published == false` → DENIED.
8. **ID Poisoning Attack**: Attacker attempts `create` on `/guideLeads/a...200chars...` or `/guideLeads/bad$id!` → DENIED (`isValidId()`).
9. **Client Timestamp Forgery**: Admin or visitor sends client-crafted `createdAt` not equal to `request.time` → DENIED (`incoming().createdAt == request.time`).
10. **Immutable Field Tampering**: Admin attempts `update` on `/experiences/exp-1` modifying `createdAt` or `createdBy` → DENIED (`affectedKeys().hasOnly(...)` + immutability check).
11. **Array Overflow / Denial of Wallet**: Admin or attacker submits `/hotels/h-1` with 25 items in `amenitiesVi` or `/siteConfig/main` with 10 stats → DENIED (`.size() <= 10` / `.size() <= 4`).
12. **Terminal State Overwrite without Admin / Value Poisoning**: Attempting to update `rateUsd` to a negative number or string, or `walkScore` to 500 → DENIED (`isValidHotel` / `isValidNeighborhood`).
