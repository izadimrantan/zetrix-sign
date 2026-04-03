// =============================================================================
// In-Memory Verification Store
// =============================================================================
// Bridges the gap between the OID4VP callback (async, server-push) and the
// frontend polling (GET /api/oid4vp/status).
//
// In production, replace with Redis or a database for multi-instance support.
// For a single Next.js server this works reliably.
// =============================================================================

import type { VerificationEntry, CredentialType, VerifiedClaims } from '@/types/oid4vp';

// Map of stateId → verification entry
const store = new Map<string, VerificationEntry>();

// Auto-expire entries after 35 minutes (slightly longer than the 30-min OID4VP default)
const ENTRY_TTL_MS = 35 * 60 * 1000;

/** Create a pending verification entry */
export function createEntry(stateId: string, credentialType: CredentialType): void {
  store.set(stateId, {
    stateId,
    credentialType,
    status: 'pending',
    createdAt: Date.now(),
  });
}

/** Get a verification entry by stateId */
export function getEntry(stateId: string): VerificationEntry | undefined {
  const entry = store.get(stateId);
  if (!entry) return undefined;

  // Check expiry
  if (Date.now() - entry.createdAt > ENTRY_TTL_MS) {
    store.delete(stateId);
    return undefined;
  }

  return entry;
}

/** Mark an entry as verified with claims */
export function completeEntry(
  stateId: string,
  claims: VerifiedClaims,
  presentationId: string
): boolean {
  const entry = store.get(stateId);
  if (!entry) return false;

  entry.status = 'verified';
  entry.claims = claims;
  entry.presentationId = presentationId;
  entry.completedAt = Date.now();
  return true;
}

/** Mark an entry as failed */
export function failEntry(stateId: string, error: string): boolean {
  const entry = store.get(stateId);
  if (!entry) return false;

  entry.status = 'failed';
  entry.error = error;
  entry.completedAt = Date.now();
  return true;
}

/** Mark an entry as expired */
export function expireEntry(stateId: string): boolean {
  const entry = store.get(stateId);
  if (!entry) return false;

  entry.status = 'expired';
  entry.error = 'Verification request expired';
  entry.completedAt = Date.now();
  return true;
}

/** Remove an entry (after frontend has consumed it) */
export function removeEntry(stateId: string): void {
  store.delete(stateId);
}

/** Cleanup expired entries (call periodically or on access) */
export function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.createdAt > ENTRY_TTL_MS) {
      store.delete(key);
    }
  }
}

/** Get store size (for debugging) */
export function size(): number {
  return store.size;
}
