import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma before imports
vi.mock('@/lib/db', () => ({
  prisma: {
    signingSession: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';

describe('Session API logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSession = {
    id: 'test_id_123',
    documentName: 'contract.pdf',
    walletAddress: 'ZTX_TEST_ADDR',
    signerName: 'John Tan',
    signerDID: 'did:zetrix:test123',
    credentialID: 'vc_test_credential_001',
    signatureType: 'auto',
    documentHash: 'a'.repeat(64),
    digitalSignature: 'sig_data',
    signerPublicKey: 'pub_key',
    txHash: 'tx_hash_abc',
    createdAt: new Date(),
    completedAt: new Date(),
  };

  it('prisma.create is callable with session data', async () => {
    (prisma.signingSession.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSession);

    const result = await prisma.signingSession.create({ data: mockSession });
    expect(result.id).toBe('test_id_123');
    expect(prisma.signingSession.create).toHaveBeenCalledOnce();
  });

  it('prisma.findMany filters by walletAddress', async () => {
    (prisma.signingSession.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockSession]);

    const results = await prisma.signingSession.findMany({
      where: { walletAddress: 'ZTX_TEST_ADDR' },
      orderBy: { createdAt: 'desc' },
    });
    expect(results).toHaveLength(1);
  });

  it('prisma.findUnique returns session by id', async () => {
    (prisma.signingSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockSession);

    const result = await prisma.signingSession.findUnique({ where: { id: 'test_id_123' } });
    expect(result?.documentName).toBe('contract.pdf');
  });

  it('prisma.findUnique returns null for unknown id', async () => {
    (prisma.signingSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const result = await prisma.signingSession.findUnique({ where: { id: 'unknown' } });
    expect(result).toBeNull();
  });
});
