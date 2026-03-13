import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VerifyUpload } from '@/components/verify/verify-upload';

vi.mock('@/lib/hash', () => ({
  computeSHA256: vi.fn().mockResolvedValue('a'.repeat(64)),
}));

describe('VerifyUpload', () => {
  it('renders upload zone with verify-specific text', () => {
    render(<VerifyUpload onHashComputed={vi.fn()} isLoading={false} />);
    expect(screen.getByText(/drag & drop a signed pdf to verify/i)).toBeInTheDocument();
  });

  it('calls onHashComputed when a PDF is selected', async () => {
    const onHashComputed = vi.fn();
    render(<VerifyUpload onHashComputed={onHashComputed} isLoading={false} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake pdf'], 'signed.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(onHashComputed).toHaveBeenCalledWith('a'.repeat(64), 'signed.pdf');
    });
  });

  it('rejects non-PDF files', () => {
    render(<VerifyUpload onHashComputed={vi.fn()} isLoading={false} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['not a pdf'], 'readme.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText(/please upload a pdf file/i)).toBeInTheDocument();
  });

  it('rejects files larger than 10MB', async () => {
    render(<VerifyUpload onHashComputed={vi.fn()} isLoading={false} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [bigFile] } });
    expect(screen.getByText(/10MB/i)).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<VerifyUpload onHashComputed={vi.fn()} isLoading={true} />);
    expect(screen.getByText(/checking blockchain records/i)).toBeInTheDocument();
  });
});
