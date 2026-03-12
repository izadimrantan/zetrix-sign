'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPdfPageCount } from '@/lib/pdf';
import type { SigningSession } from '@/types/signing';

interface StepProps {
  session: SigningSession;
  updateSession: (partial: Partial<SigningSession>) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  resetSession: () => void;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function StepUpload({ session, updateSession, nextStep }: StepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setError('');
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('PDF must be under 10MB.');
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageCount = await getPdfPageCount(bytes);
      updateSession({ pdfFile: file, pdfPageCount: pageCount });
    } catch {
      setError('Failed to read PDF. Please try another file.');
    }
  }, [updateSession]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Document</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag & drop your PDF here, or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">PDF only, max 10MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={onFileChange}
            className="hidden"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {session.pdfFile && (
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <FileText className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <p className="font-medium">{session.pdfFile.name}</p>
              <p className="text-sm text-muted-foreground">{session.pdfPageCount} page(s)</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); updateSession({ pdfFile: null, pdfPageCount: 0 }); }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={nextStep} disabled={!session.pdfFile}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
