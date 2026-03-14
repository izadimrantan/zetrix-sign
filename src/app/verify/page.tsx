'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { VerifyUpload } from '@/components/verify/verify-upload';
import { VerifyResult } from '@/components/verify/verify-result';
import { validateDocument } from '@/lib/blockchain';
import { Button } from '@/components/ui/button';
import { trackVerifyStart, trackVerifyResult, trackVerifyError, trackVerifyAnother } from '@/lib/analytics';
import type { ValidationResult } from '@/types/contract';

function VerifyContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [documentHash, setDocumentHash] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const verifyHash = useCallback(async (hash: string, source: 'file_upload' | 'query_param' = 'file_upload') => {
    setIsLoading(true);
    setResult(null);
    setError('');
    trackVerifyStart(source);
    try {
      const validationResult = await validateDocument(hash);
      setResult(validationResult);
      const status = validationResult.isValid ? 'valid' : validationResult.reason?.includes('revoked') ? 'revoked' : validationResult.reason?.includes('No record') ? 'not_found' : 'invalid';
      trackVerifyResult(status, hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed. Please try again.';
      trackVerifyError(msg);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const hash = searchParams.get('hash');
    if (hash && /^[a-f0-9]{64}$/i.test(hash)) {
      setDocumentHash(hash);
      const fileParam = searchParams.get('file');
      setFileName(fileParam ? decodeURIComponent(fileParam) : '(hash provided via link)');
      verifyHash(hash, 'query_param');
    }
  }, [searchParams, verifyHash]);

  const handleHashComputed = (hash: string, name: string) => {
    setDocumentHash(hash);
    setFileName(name);
    verifyHash(hash);
  };

  const handleReset = () => {
    trackVerifyAnother();
    setResult(null);
    setDocumentHash('');
    setFileName('');
    setError('');
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {!result && !error && (
        <VerifyUpload onHashComputed={handleHashComputed} isLoading={isLoading} />
      )}

      {result && (
        <div className="space-y-4">
          <VerifyResult result={result} documentHash={documentHash} fileName={fileName} />
          <div className="text-center">
            <Button variant="outline" onClick={handleReset}>Verify Another Document</Button>
          </div>
        </div>
      )}

      {error && (
        <div className="space-y-4 text-center">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={handleReset}>Try Again</Button>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="container mx-auto max-w-2xl px-4 py-8 text-center">Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
