import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StepUpload } from '@/components/signing/step-upload';
import { SigningStep } from '@/types/signing';

// Mock getPdfPageCount so we don't need a real PDF
vi.mock('@/lib/pdf', () => ({
  getPdfPageCount: vi.fn().mockResolvedValue(1),
}));

const createMockProps = () => ({
  session: {
    currentStep: SigningStep.Upload,
    pdfFile: null,
    pdfPageCount: 0,
    walletAddress: '', publicKey: '', connectionMethod: '' as const,
    signerName: '', signerDID: '', credentialID: '', credentialType: '' as const, verifiedClaims: null,
    signatureType: '' as const, signatureImage: '',
    signaturePosition: null,
    documentHash: '', digitalSignature: '', txHash: '',
    anchorVersion: '2.0', cmsSessionId: '', downloadToken: '',
    timestamp: '',
  },
  updateSession: vi.fn(),
  nextStep: vi.fn(),
  prevStep: vi.fn(),
  goToStep: vi.fn(),
  resetSession: vi.fn(),
});

describe('StepUpload', () => {
  it('renders upload zone', () => {
    const mockProps = createMockProps();
    render(<StepUpload {...mockProps} />);
    expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
  });

  it('shows file name after selecting a PDF', async () => {
    const mockProps = createMockProps();
    render(<StepUpload {...mockProps} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake pdf'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(mockProps.updateSession).toHaveBeenCalled();
    });
  });

  it('rejects non-PDF files', () => {
    const mockProps = createMockProps();
    render(<StepUpload {...mockProps} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['not a pdf'], 'test.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    // updateSession should NOT be called for invalid file types
    // Error message should appear
    expect(screen.getByText('Please upload a PDF file.')).toBeInTheDocument();
  });
});
