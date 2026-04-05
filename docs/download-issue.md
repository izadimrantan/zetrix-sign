# Mobile PDF Download Issue

## Problem

On the "Document Signed Successfully" screen, the **Download Signed PDF** button does not work on mobile:

- **iOS Safari**: Page turns blank (grey screen) without actually downloading any file.
- **iOS Chrome**: File downloads but opens as an empty/black page.

Desktop (Windows/Mac) download works fine.

---

## Technical Flow: How the PDF Bytes Reach the Download Button

### Phase 1: PDF Generation (server-side + client-side)

#### Step 1 — Client reads the original PDF from a `File` object
**File**: `src/components/signing/step-anchoring.tsx` (line ~123)
```ts
const pdfBytes = new Uint8Array(await session.pdfFile!.arrayBuffer());
```
`session.pdfFile` is a browser `File` object stored in React state. It was selected by the user in an earlier step.

#### Step 2 — Client embeds visual signature image onto the PDF
**File**: `src/lib/pdf.ts`
```ts
const visualPdf = await embedSignatureOnPdf(pdfBytes, { signatureImage, position, signerName, walletAddress });
```
Uses `pdf-lib` to draw the signature PNG and text annotation onto the PDF page. Returns `Uint8Array` (the modified PDF bytes).

#### Step 3 — Client encodes PDF to base64 and sends to server
**File**: `src/components/signing/step-anchoring.tsx` (line ~137)
```ts
const pdfBase64 = Buffer.from(visualPdf).toString('base64');
```
Note: This uses the `Buffer` polyfill available in Next.js client-side bundles. The entire PDF is base64-encoded and sent as a JSON string in the request body:
```ts
const cmsSignRes = await fetch('/api/signing/cms-sign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ pdfBase64, ...otherFields }),
});
```

#### Step 4 — Server decodes base64, signs PDF with CMS/PKCS#7, returns base64
**File**: `src/app/api/signing/cms-sign/route.ts`
```ts
// Decode
const pdfBytes = new Uint8Array(Buffer.from(pdfBase64, 'base64'));

// ... generates X.509 cert, embeds XMP metadata, adds signature placeholder ...

// Sign
const signedPdfBuffer = await signPdf.sign(pdfWithPlaceholder, signer, signingTime);

// Compute SHA-256 hash
const signedPdf = new Uint8Array(signedPdfBuffer);
const finalHashBuffer = await crypto.subtle.digest('SHA-256', signedPdf);

// Encode back to base64 and return
const signedPdfBase64 = Buffer.from(signedPdf).toString('base64');
return NextResponse.json({ success: true, signedPdfBase64, documentHash });
```

The server returns the entire signed PDF as a base64 string inside a JSON response. For a typical 1-2 MB PDF, the base64 string is ~1.3-2.7 MB, and the full JSON response body is slightly larger.

#### Step 5 — Client decodes base64 response back to bytes
**File**: `src/components/signing/step-anchoring.tsx` (line ~171)
```ts
const { signedPdfBase64, documentHash } = await cmsSignRes.json();
const cmsSignedPdfBytes = base64ToBytes(signedPdfBase64);
```
Where `base64ToBytes` is:
```ts
function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}
```
Previously this used `Uint8Array.from(atob(base64), c => c.charCodeAt(0))` which creates an intermediate array — potentially problematic on memory-constrained mobile devices.

#### Step 6 — (Optional) Server appends blockchain anchor XMP metadata
**File**: `src/app/api/signing/cms-anchor/route.ts`

After the blockchain transaction succeeds, the client sends `signedPdfBase64` (the same base64 string from step 4) to this endpoint. The server:
1. Decodes from base64 using `Buffer.from(signedPdfBase64, 'base64')`
2. Appends XMP metadata via incremental update (appends after `%%EOF`, does not modify existing bytes)
3. Re-encodes to base64 and returns as `finalPdfBase64`

Back in the client:
```ts
if (!anchorRes.ok) {
  // Fallback: use CMS-signed PDF without anchor metadata
  signedPdfBytesRef.current = cmsSignedPdfBytes;
} else {
  const { finalPdfBase64 } = await anchorRes.json();
  signedPdfBytesRef.current = base64ToBytes(finalPdfBase64);
}
```

### Phase 2: Storing the PDF Bytes

The final PDF bytes are stored in a React ref:
```ts
// In signing-stepper.tsx (parent component)
const signedPdfBytesRef = useRef<Uint8Array | null>(null);
```
This ref is passed as a prop to both `StepAnchoring` (which writes to it) and `StepComplete` (which reads from it). The ref persists across step transitions since the parent component (`SigningStepper`) remains mounted.

**Important**: The PDF bytes are NOT serialized to `sessionStorage`. Only metadata (hashes, addresses, etc.) is persisted. If the page is refreshed, `signedPdfBytesRef.current` will be `null`.

### Phase 3: Download Trigger

**File**: `src/components/signing/step-complete.tsx`

When the user taps "Download Signed PDF":

```ts
const handleDownload = useCallback(async () => {
  const bytes = signedPdfBytesRef.current;
  if (!bytes) {
    alert('Signed PDF is no longer in memory. Please sign the document again.');
    return;
  }

  const filename = session.pdfFile?.name?.replace('.pdf', '-signed.pdf') || 'signed-document.pdf';
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });

  // Strategy 1: navigator.share() — native share sheet
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (shareErr) {
      if ((shareErr as DOMException)?.name === 'AbortError') return;
      console.warn('[Download] Share failed, falling back:', shareErr);
    }
  }

  const url = URL.createObjectURL(blob);

  // Strategy 2: iOS — open blob URL in new tab
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Strategy 3: Desktop/Android — programmatic <a download> click
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}, [signedPdfBytesRef, session.pdfFile?.name]);
```

---

## Known Issues & Hypotheses

### 1. `navigator.share()` requires HTTPS
- `navigator.share()` with files only works on HTTPS origins.
- During development the app is served over HTTP (`http://192.168.0.103:3000`).
- On HTTP, `navigator.canShare({ files: [file] })` likely returns `false`, so it falls through.
- On iOS Safari, the fallback is `window.open(url, '_blank')` with a blob URL — this may also fail or show a blank page depending on iOS version.

### 2. iOS Safari: blob URLs in new tabs
- `window.open(blob:...)` behavior on iOS Safari is unreliable. Some iOS versions block blob URL navigation entirely (shows blank page). Others show the PDF but don't allow saving.
- The previous approach `<a download>` with a blob URL caused the current tab to navigate to the blob and turn blank (no back button).

### 3. iOS Chrome: empty/black PDF
- Chrome on iOS uses WebKit under the hood (Apple's requirement).
- The `<a download>` fallback triggers a file download, but the content may be corrupted.
- **Possible cause**: The base64 → bytes conversion. `atob()` returns a binary string where each character is one byte. The for-loop conversion should be correct, but on very large strings, `atob()` itself can fail silently or truncate on memory-constrained iOS WebKit.
- **Possible cause**: The JSON response containing the base64 PDF may be truncated. If the response is very large (multi-MB), `await response.json()` on mobile Safari/WebKit may have issues parsing it.

### 4. Data integrity through the chain
The PDF bytes go through multiple encode/decode cycles:
1. `File.arrayBuffer()` → `Uint8Array` (client, original PDF)
2. `pdf-lib` modifies → `Uint8Array` (client, with visual signature)
3. `Buffer.from(bytes).toString('base64')` (client, encode for upload)
4. `Buffer.from(base64, 'base64')` (server, decode)
5. `@signpdf` signs → `Buffer` → `Uint8Array` (server)
6. `Buffer.from(bytes).toString('base64')` (server, encode for response)
7. JSON response → `atob(base64)` → for-loop → `Uint8Array` (client, decode)
8. (Optional) Re-encode to base64 → send to cms-anchor → decode → append XMP → re-encode → JSON response → decode again (steps 3-7 repeated)
9. Store in `useRef` as `Uint8Array`
10. `new Blob([new Uint8Array(bytes)])` → `URL.createObjectURL()` → download

Each encode/decode is a potential point of corruption, especially on mobile with limited memory.

---

## Testing Environment
- **Device**: iPhone (iOS Safari + iOS Chrome)
- **Network**: Local dev server at `http://192.168.0.103:3000` (HTTP, not HTTPS)
- **Framework**: Next.js 15 (App Router)
- **PDF sizes**: Typical test PDFs are 100KB–2MB

## Relevant Files
| File | Role |
|------|------|
| `src/components/signing/step-complete.tsx` | Download button + `handleDownload()` logic |
| `src/components/signing/step-anchoring.tsx` | Orchestrates PDF generation, stores bytes in ref |
| `src/components/signing/signing-stepper.tsx` | Parent: creates `signedPdfBytesRef` |
| `src/app/api/signing/cms-sign/route.ts` | Server: CMS signs PDF, returns base64 |
| `src/app/api/signing/cms-anchor/route.ts` | Server: appends anchor XMP, returns base64 |
| `src/lib/pdf.ts` | Client: embeds visual signature via pdf-lib |
| `src/lib/cms/incremental-update.ts` | Server: incremental XMP append after %%EOF |

## Suggested Investigation Areas
1. **Verify the bytes are valid**: Add a `console.log` of `signedPdfBytesRef.current?.length` and first 10 bytes (should start with `%PDF` = `[37, 80, 68, 70]`) right before download.
2. **Test with a server-side download endpoint**: Instead of client-side blob, create `GET /api/signing/download` that stores the PDF server-side and serves it with proper `Content-Disposition` header. This bypasses all blob/share/iOS issues.
3. **Check if base64 is truncated**: Log `signedPdfBase64.length` on both server and client to verify they match.
4. **Test smaller PDFs**: Try with a very small (< 50KB) PDF to rule out memory issues.
5. **HTTPS**: Test with HTTPS (e.g., ngrok tunnel) to see if `navigator.share()` works correctly.
