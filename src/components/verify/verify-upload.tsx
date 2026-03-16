'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileSearch, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { computeSHA256 } from '@/lib/hash';
import { trackVerifyFileUpload } from '@/lib/analytics';

interface Props {
  onHashComputed: (hash: string, fileName: string) => void;
  isLoading: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function VerifyUpload({ onHashComputed, isLoading }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const handleFile = useCallback(async (file: File) => {
    setError('');
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('PDF must be under 10MB.');
      return;
    }
    setFileName(file.name);
    trackVerifyFileUpload(file.name);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hash = await computeSHA256(bytes);
      onHashComputed(hash, file.name);
    } catch {
      setError('Failed to read PDF.');
    }
  }, [onHashComputed]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
    <Card className="relative overflow-hidden border-[var(--zetrix-border)] shadow-sm">
      <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="h-5 w-5" />
          Verify Document
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload a previously signed PDF to verify its authenticity against the blockchain.
        </p>
        <p className="text-xs text-muted-foreground/70">
          You can only verify one PDF at a time.
        </p>

        {isLoading ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verifying {fileName}...</p>
            <p className="text-xs text-muted-foreground">Checking blockchain records...</p>
          </div>
        ) : (
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
              Drag & drop a signed PDF to verify, or click to browse
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              className="hidden"
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
    </div>
  );
}
