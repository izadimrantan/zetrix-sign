import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

const mockValidateDocument = vi.fn();
vi.mock('@/lib/blockchain', () => ({
  validateDocument: (...args: unknown[]) => mockValidateDocument(...args),
}));

vi.mock('@/lib/hash', () => ({
  computeSHA256: vi.fn().mockResolvedValue('a'.repeat(64)),
}));

import VerifyPage from '@/app/verify/page';

describe('VerifyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the upload component initially', () => {
    render(<VerifyPage />);
    expect(screen.getByText(/drag & drop a signed pdf to verify/i)).toBeInTheDocument();
  });

  it('shows error state with retry button on verification failure', async () => {
    mockValidateDocument.mockRejectedValueOnce(new Error('Network error'));
    render(<VerifyPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
  });

  it('shows result after successful verification', async () => {
    mockValidateDocument.mockResolvedValueOnce({
      isValid: true,
      reason: 'Document is valid',
      signerAddress: 'ZTX3test',
      credentialID: 'vc_test',
      timestamp: 1710000000,
    });
    render(<VerifyPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText('Document Verified')).toBeInTheDocument();
    });
    expect(screen.getByText(/verify another/i)).toBeInTheDocument();
  });

  it('resets state when "Verify Another Document" is clicked', async () => {
    mockValidateDocument.mockResolvedValueOnce({
      isValid: true,
      reason: 'Document is valid',
      signerAddress: 'ZTX3test',
      credentialID: 'vc_test',
      timestamp: 1710000000,
    });
    render(<VerifyPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText(/verify another/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/verify another/i));
    expect(screen.getByText(/drag & drop a signed pdf to verify/i)).toBeInTheDocument();
  });
});
