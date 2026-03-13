import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerifyResult } from '@/components/verify/verify-result';
import type { ValidationResult } from '@/types/contract';

describe('VerifyResult', () => {
  it('shows valid result with signer details', () => {
    const result: ValidationResult = {
      isValid: true,
      reason: 'Document is valid and cryptographically verified',
      signerAddress: 'ZTX3S4ntGLTJw9vVNpCX6Ash6wZhaLLV9BS5S',
      credentialID: 'vc_test_credential_001',
      timestamp: 1710000000,
    };
    render(<VerifyResult result={result} documentHash={'a'.repeat(64)} fileName="test.pdf" />);
    expect(screen.getByText('Document Verified')).toBeInTheDocument();
    expect(screen.getByText('Valid')).toBeInTheDocument();
    expect(screen.getByText(/ZTX3S4ntGL/)).toBeInTheDocument();
    expect(screen.getByText('vc_test_credential_001')).toBeInTheDocument();
  });

  it('shows not-found result', () => {
    const result: ValidationResult = {
      isValid: false,
      reason: 'No record found for this documentHash',
    };
    render(<VerifyResult result={result} documentHash={'b'.repeat(64)} fileName="unknown.pdf" />);
    expect(screen.getByText('No Record Found')).toBeInTheDocument();
    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });

  it('shows revoked result', () => {
    const result: ValidationResult = {
      isValid: false,
      reason: 'Document has been revoked',
    };
    render(<VerifyResult result={result} documentHash={'c'.repeat(64)} fileName="revoked.pdf" />);
    expect(screen.getByText('Document Revoked')).toBeInTheDocument();
    expect(screen.getByText('Revoked')).toBeInTheDocument();
  });

  it('shows crypto failure result', () => {
    const result: ValidationResult = {
      isValid: false,
      reason: 'Cryptographic verification failed',
    };
    render(<VerifyResult result={result} documentHash={'d'.repeat(64)} fileName="tampered.pdf" />);
    expect(screen.getByText('Verification Failed')).toBeInTheDocument();
    expect(screen.getByText('Invalid')).toBeInTheDocument();
  });
});
