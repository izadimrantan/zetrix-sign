'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  file: File;
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  width?: number;
  children?: React.ReactNode; // Overlay elements
}

export function PdfViewer({ file, pageCount, currentPage, onPageChange, width = 600, children }: Props) {
  const [fileUrl] = useState(() => URL.createObjectURL(file));

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-block rounded-lg border shadow-sm">
        <Document file={fileUrl} loading={<div className="flex h-[800px] w-[600px] items-center justify-center">Loading...</div>}>
          <Page pageNumber={currentPage + 1} width={width} />
        </Document>
        {children}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">Page {currentPage + 1} of {pageCount}</span>
          <Button variant="outline" size="icon" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= pageCount - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
