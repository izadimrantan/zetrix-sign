import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSession,
  getSession,
  deleteSession,
  cleanExpiredSessions,
  clearAllSessions,
} from '@/lib/signing-session-store';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeDummyData() {
  return {
    pdfBytesWithPlaceholder: new Uint8Array([1, 2, 3]),
    byteRange: [0, 100, 200, 300] as [number, number, number, number],
    cert: new Uint8Array([4, 5, 6]),
    signerPublicKey: 'abcdef1234567890',
    signedAttrsDer: new Uint8Array([7, 8, 9]),
    signedAttrsSet: { dummy: true },
    documentHash: 'sha256-abc123',
  };
}

describe('signing-session-store', () => {
  beforeEach(() => {
    vi.useRealTimers();
    clearAllSessions();
  });

  it('createSession returns a UUID string', () => {
    const id = createSession(makeDummyData());
    expect(id).toMatch(UUID_REGEX);
  });

  it('getSession returns the stored session', () => {
    const data = makeDummyData();
    const id = createSession(data);
    const session = getSession(id);

    expect(session).not.toBeNull();
    expect(session!.id).toBe(id);
    expect(session!.signerPublicKey).toBe(data.signerPublicKey);
    expect(session!.documentHash).toBe(data.documentHash);
    expect(session!.createdAt).toBeTypeOf('number');
    expect(session!.expiresAt).toBeGreaterThan(session!.createdAt);
  });

  it('getSession returns null for non-existent ID', () => {
    expect(getSession('non-existent-id')).toBeNull();
  });

  it('deleteSession removes the session', () => {
    const id = createSession(makeDummyData());
    expect(getSession(id)).not.toBeNull();

    deleteSession(id);
    expect(getSession(id)).toBeNull();
  });

  it('expired sessions return null from getSession', () => {
    vi.useFakeTimers();

    const id = createSession(makeDummyData());
    expect(getSession(id)).not.toBeNull();

    // Advance past 5-minute TTL
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(getSession(id)).toBeNull();
  });

  it('cleanExpiredSessions removes only expired sessions', () => {
    vi.useFakeTimers();

    const expiredId = createSession(makeDummyData());

    // Advance 4 minutes — not yet expired
    vi.advanceTimersByTime(4 * 60 * 1000);

    const freshId = createSession(makeDummyData());

    // Advance 2 more minutes — first session now expired (6 min total),
    // second session still valid (2 min old)
    vi.advanceTimersByTime(2 * 60 * 1000);

    cleanExpiredSessions();

    expect(getSession(expiredId)).toBeNull();
    expect(getSession(freshId)).not.toBeNull();
  });
});
