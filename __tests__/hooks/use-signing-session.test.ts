import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSigningSession } from '@/hooks/use-signing-session';
import { SigningStep } from '@/types/signing';

describe('useSigningSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('initializes with step 0 (Upload) and empty state', () => {
    const { result } = renderHook(() => useSigningSession());
    expect(result.current.session.currentStep).toBe(SigningStep.Upload);
    expect(result.current.session.pdfFile).toBeNull();
    expect(result.current.session.walletAddress).toBe('');
  });

  it('goToStep changes the current step', () => {
    const { result } = renderHook(() => useSigningSession());
    act(() => {
      result.current.goToStep(SigningStep.WalletIdentity);
    });
    expect(result.current.session.currentStep).toBe(SigningStep.WalletIdentity);
  });

  it('nextStep increments the step', () => {
    const { result } = renderHook(() => useSigningSession());
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.session.currentStep).toBe(SigningStep.WalletIdentity);
  });

  it('prevStep decrements the step but not below 0', () => {
    const { result } = renderHook(() => useSigningSession());
    act(() => {
      result.current.prevStep();
    });
    expect(result.current.session.currentStep).toBe(SigningStep.Upload);
  });

  it('updateSession merges partial data', () => {
    const { result } = renderHook(() => useSigningSession());
    act(() => {
      result.current.updateSession({ walletAddress: 'ZTX_ADDR', publicKey: 'PUB_KEY' });
    });
    expect(result.current.session.walletAddress).toBe('ZTX_ADDR');
    expect(result.current.session.publicKey).toBe('PUB_KEY');
  });

  it('resetSession clears all state and sessionStorage', () => {
    const { result } = renderHook(() => useSigningSession());
    act(() => {
      result.current.updateSession({ walletAddress: 'ZTX_ADDR' });
      result.current.goToStep(SigningStep.Review);
    });
    act(() => {
      result.current.resetSession();
    });
    expect(result.current.session.currentStep).toBe(SigningStep.Upload);
    expect(result.current.session.walletAddress).toBe('');
  });

  it('persists serializable fields to sessionStorage on step change', () => {
    const { result } = renderHook(() => useSigningSession());
    act(() => {
      result.current.updateSession({ walletAddress: 'ZTX_ADDR' });
      result.current.nextStep();
    });
    const stored = sessionStorage.getItem('zetrix-sign-session');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.walletAddress).toBe('ZTX_ADDR');
  });

  it('restores session from sessionStorage on mount (without pdfFile)', () => {
    sessionStorage.setItem(
      'zetrix-sign-session',
      JSON.stringify({
        walletAddress: 'ZTX_RESTORED',
        publicKey: 'PK',
        connectionMethod: 'extension',
        signerName: '',
        signerDID: '',
        credentialID: '',
        signatureType: '',
        signatureImage: '',
        signaturePosition: null,
        currentStep: 2,
        documentHash: '',
        digitalSignature: '',
        txHash: '',
        timestamp: '',
      })
    );
    const { result } = renderHook(() => useSigningSession());
    // Restored to step 0 because pdfFile is missing (can't serialize File)
    expect(result.current.session.currentStep).toBe(SigningStep.Upload);
    expect(result.current.session.walletAddress).toBe('ZTX_RESTORED');
  });
});
