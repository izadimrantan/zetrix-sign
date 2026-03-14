'use client';

import { useRef } from 'react';
import { SigningStep } from '@/types/signing';
import { useSigningSession } from '@/hooks/use-signing-session';
import { cn } from '@/lib/utils';
import { StepUpload } from './step-upload';
import { StepWalletIdentity } from './step-wallet-identity';
import { StepSignature } from './step-signature';
import { StepPlacement } from './step-placement';
import { StepReview } from './step-review';
import { StepAnchoring } from './step-anchoring';
import { StepComplete } from './step-complete';

const STEP_LABELS = [
  'Upload', 'Wallet & Identity', 'Signature',
  'Placement', 'Review', 'Anchoring', 'Complete',
];

export function SigningStepper() {
  const { session, updateSession, nextStep, prevStep, goToStep, resetSession } = useSigningSession();
  const currentStep = session.currentStep;

  // Holds the signed PDF bytes from the anchoring step for download in the completion step.
  // Using useRef because Uint8Array should not be in React state (non-serializable, large).
  const signedPdfBytesRef = useRef<Uint8Array | null>(null);

  const stepProps = { session, updateSession, nextStep, prevStep, goToStep, resetSession, signedPdfBytesRef };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Step indicator */}
      <div className="mb-8">
        {/* Circles + connectors row */}
        <div className="flex items-center">
          {STEP_LABELS.map((_, index) => (
            <div key={index} className="flex flex-1 items-center justify-center">
              {index > 0 && (
                <div className={cn(
                  'h-0.5 flex-1',
                  index <= currentStep ? 'bg-primary' : 'bg-muted'
                )} />
              )}
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                  index < currentStep && 'bg-primary text-primary-foreground',
                  index === currentStep && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                  index > currentStep && 'bg-muted text-muted-foreground'
                )}
              >
                {index + 1}
              </div>
              {index < STEP_LABELS.length - 1 && (
                <div className={cn(
                  'h-0.5 flex-1',
                  index < currentStep ? 'bg-primary' : 'bg-muted'
                )} />
              )}
            </div>
          ))}
        </div>
        {/* Labels row */}
        <div className="mt-1 hidden sm:flex">
          {STEP_LABELS.map((label) => (
            <span key={label} className="flex-1 text-center text-[10px] text-muted-foreground">
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Step content */}
      {currentStep === SigningStep.Upload && <StepUpload {...stepProps} />}
      {currentStep === SigningStep.WalletIdentity && <StepWalletIdentity {...stepProps} />}
      {currentStep === SigningStep.Signature && <StepSignature {...stepProps} />}
      {currentStep === SigningStep.Placement && <StepPlacement {...stepProps} />}
      {currentStep === SigningStep.Review && <StepReview {...stepProps} />}
      {currentStep === SigningStep.Anchoring && <StepAnchoring {...stepProps} />}
      {currentStep === SigningStep.Complete && <StepComplete {...stepProps} />}
    </div>
  );
}
