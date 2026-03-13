'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { VerifyUpload } from '@/components/verify/verify-upload';
import { VerifyResult } from '@/components/verify/verify-result';
import { validateDocument } from '@/lib/blockchain';
import { Button } from '@/components/ui/button';
import type { ValidationResult } from '@/types/contract';

function VerifyContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [documentHash, setDocumentHash] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const verifyHash = useCallback(async (hash: string) => {
    setIsLoading(true);
    setResult(null);
    setError('');
    try {
      const validationResult = await validateDocument(hash);
      setResult(validationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const hash = searchParams.get('hash');
    if (hash && /^[a-f0-9]{64}$/i.test(hash)) {
      setDocumentHash(hash);
      setFileName('(hash provided via link)');
      verifyHash(hash);
    }
  }, [searchParams, verifyHash]);

  const handleHashComputed = (hash: string, name: string) => {
    setDocumentHash(hash);
    setFileName(name);
    verifyHash(hash);
  };

  const handleReset = () => {
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
