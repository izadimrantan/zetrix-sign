'use client';

import { useRef } from 'react';
import { SigningStep } from '@/types/signing';
import { useSigningSession } from '@/hooks/use-signing-session';
import { cn } from '@/lib/utils';
import { StepUpload } from './step-upload';
import { StepWallet } from './step-wallet';
import { StepCredential } from './step-credential';
import { StepSignature } from './step-signature';
import { StepPlacement } from './step-placement';
import { StepReview } from './step-review';
import { StepAnchoring } from './step-anchoring';
import { StepComplete } from './step-complete';

const STEP_LABELS = [
  'Upload', 'Wallet', 'Identity', 'Signature',
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
      <div className="mb-8 flex items-center justify-between">
        {STEP_LABELS.map((label, index) => (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium',
                  index < currentStep && 'bg-primary text-primary-foreground',
                  index === currentStep && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                  index > currentStep && 'bg-muted text-muted-foreground'
                )}
              >
                {index + 1}
              </div>
              <span className="mt-1 hidden text-xs sm:block">{label}</span>
            </div>
            {index < STEP_LABELS.length - 1 && (
              <div className={cn(
                'mx-1 h-0.5 flex-1',
                index < currentStep ? 'bg-primary' : 'bg-muted'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {currentStep === SigningStep.Upload && <StepUpload {...stepProps} />}
      {currentStep === SigningStep.Wallet && <StepWallet {...stepProps} />}
      {currentStep === SigningStep.Credential && <StepCredential {...stepProps} />}
      {currentStep === SigningStep.Signature && <StepSignature {...stepProps} />}
      {currentStep === SigningStep.Placement && <StepPlacement {...stepProps} />}
      {currentStep === SigningStep.Review && <StepReview {...stepProps} />}
      {currentStep === SigningStep.Anchoring && <StepAnchoring {...stepProps} />}
      {currentStep === SigningStep.Complete && <StepComplete {...stepProps} />}
    </div>
  );
}
