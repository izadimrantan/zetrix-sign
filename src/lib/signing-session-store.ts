import { randomUUID } from 'crypto';
import type { CmsSigningSession } from '@/types/cms';

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

const sessions = new Map<string, CmsSigningSession>();

export function createSession(
  data: Omit<CmsSigningSession, 'id' | 'createdAt' | 'expiresAt'>
): string {
  cleanExpiredSessions();

  const id = randomUUID();
  const createdAt = Date.now();
  const expiresAt = createdAt + SESSION_TTL_MS;

  sessions.set(id, { ...data, id, createdAt, expiresAt });

  return id;
}

export function getSession(id: string): CmsSigningSession | null {
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return session;
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}

export function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt < now) {
      sessions.delete(id);
    }
  }
}

/** For testing only — clears all sessions regardless of expiry. */
export function clearAllSessions(): void {
  sessions.clear();
}
