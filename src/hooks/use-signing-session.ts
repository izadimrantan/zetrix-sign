'use client';

import { useState, useEffect, useCallback } from 'react';
import { SigningStep, type SigningSession, type SerializableSession } from '@/types/signing';

const STORAGE_KEY = 'zetrix-sign-session';

const INITIAL_SESSION: SigningSession = {
  pdfFile: null,
  pdfPageCount: 0,
  walletAddress: '',
  publicKey: '',
  connectionMethod: '',
  signerName: '',
  signerDID: '',
  credentialID: '',
  signatureType: '',
  signatureImage: '',
  signaturePosition: null,
  documentHash: '',
  digitalSignature: '',
  txHash: '',
  anchorVersion: '2.0',
  cmsSessionId: '',
  currentStep: SigningStep.Upload,
  timestamp: '',
};

function toSerializable(session: SigningSession): SerializableSession {
  return {
    walletAddress: session.walletAddress,
    publicKey: session.publicKey,
    connectionMethod: session.connectionMethod,
    signerName: session.signerName,
    signerDID: session.signerDID,
    credentialID: session.credentialID,
    signatureType: session.signatureType,
    signatureImage: session.signatureImage,
    signaturePosition: session.signaturePosition,
    currentStep: session.currentStep,
    documentHash: session.documentHash,
    digitalSignature: session.digitalSignature,
    txHash: session.txHash,
    anchorVersion: session.anchorVersion,
    cmsSessionId: session.cmsSessionId,
    timestamp: session.timestamp,
  };
}

export function useSigningSession() {
  const [session, setSession] = useState<SigningSession>(() => {
    // Try to restore from sessionStorage
    if (typeof window === 'undefined') return INITIAL_SESSION;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: SerializableSession = JSON.parse(stored);
        const restored: SigningSession = {
          ...INITIAL_SESSION,
          walletAddress: parsed.walletAddress,
          publicKey: parsed.publicKey,
          connectionMethod: parsed.connectionMethod as SigningSession['connectionMethod'],
          signerName: parsed.signerName,
          signerDID: parsed.signerDID,
          credentialID: parsed.credentialID,
          signatureType: parsed.signatureType as SigningSession['signatureType'],
          signatureImage: parsed.signatureImage,
          signaturePosition: parsed.signaturePosition,
          documentHash: parsed.documentHash,
          digitalSignature: parsed.digitalSignature,
          txHash: parsed.txHash,
          anchorVersion: parsed.anchorVersion || '2.0',
          cmsSessionId: parsed.cmsSessionId || '',
          timestamp: parsed.timestamp,
          pdfFile: null, // File can't be serialized
          pdfPageCount: 0,
          // If there was a step beyond Upload but no PDF, reset to Upload
          currentStep: SigningStep.Upload,
        };
        return restored;
      }
    } catch {
      // Ignore parse errors
    }
    return INITIAL_SESSION;
  });

  // Persist to sessionStorage when session changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSerializable(session)));
    } catch {
      // Ignore storage errors
    }
  }, [session]);

  const updateSession = useCallback((partial: Partial<SigningSession>) => {
    setSession((prev) => ({ ...prev, ...partial }));
  }, []);

  const goToStep = useCallback((step: SigningStep) => {
    setSession((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const nextStep = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, SigningStep.Complete) as SigningStep,
    }));
  }, []);

  const prevStep = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, SigningStep.Upload) as SigningStep,
    }));
  }, []);

  const resetSession = useCallback(() => {
    setSession(INITIAL_SESSION);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    session,
    updateSession,
    goToStep,
    nextStep,
    prevStep,
    resetSession,
  };
}
