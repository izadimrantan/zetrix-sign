/**
 * Google Analytics event tracking utility.
 * All custom events are typed and centralized here.
 */

// Extend Window to include gtag
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
}

// ============================================
// Landing Page
// ============================================

export function trackLandingCTA(button: 'upload_document' | 'verify_document') {
  trackEvent('landing_cta_click', { button });
}

// ============================================
// Navigation
// ============================================

export function trackNavClick(destination: 'home' | 'sign' | 'verify') {
  trackEvent('nav_click', { destination });
}

// ============================================
// Signing Flow — Step Navigation
// ============================================

export function trackStepEnter(step: number, stepName: string) {
  trackEvent('signing_step_enter', { step, step_name: stepName });
}

export function trackStepExit(step: number, stepName: string, direction: 'next' | 'back') {
  trackEvent('signing_step_exit', { step, step_name: stepName, direction });
}

// ============================================
// Step 1: Upload
// ============================================

export function trackFileUpload(fileName: string, pageCount: number, fileSizeMB: number) {
  trackEvent('file_upload', { file_name: fileName, page_count: pageCount, file_size_mb: fileSizeMB });
}

export function trackFileRemove() {
  trackEvent('file_remove');
}

export function trackFileUploadError(reason: string) {
  trackEvent('file_upload_error', { reason });
}

// ============================================
// Step 2: Wallet & Identity
// ============================================

export function trackWalletConnectStart(method: 'extension' | 'mobile') {
  trackEvent('wallet_connect_start', { method });
}

export function trackWalletConnectSuccess(method: 'extension' | 'mobile', address: string) {
  trackEvent('wallet_connect_success', { method, wallet_address: address });
}

export function trackWalletConnectError(method: 'extension' | 'mobile', error: string) {
  trackEvent('wallet_connect_error', { method, error });
}

export function trackIdentityConfirmed(credentialID: string) {
  trackEvent('identity_confirmed', { credential_id: credentialID });
}

// ============================================
// Step 3: Signature
// ============================================

export function trackSignatureCreated(type: 'auto' | 'drawn') {
  trackEvent('signature_created', { type });
}

export function trackSignatureCleared() {
  trackEvent('signature_cleared');
}

export function trackSignatureTabSwitch(tab: 'auto' | 'draw') {
  trackEvent('signature_tab_switch', { tab });
}

// ============================================
// Step 4: Placement
// ============================================

export function trackSignaturePlaced(page: number, x: number, y: number) {
  trackEvent('signature_placed', { page, x: Math.round(x), y: Math.round(y) });
}

export function trackSignatureMoved() {
  trackEvent('signature_moved');
}

// ============================================
// Step 5: Review
// ============================================

export function trackReviewConfirmed() {
  trackEvent('review_confirmed');
}

// ============================================
// Step 6: Anchoring
// ============================================

export function trackAnchoringStart() {
  trackEvent('anchoring_start');
}

export function trackAnchoringSubStep(subStep: string) {
  trackEvent('anchoring_substep', { sub_step: subStep });
}

export function trackAnchoringSuccess(txHash: string) {
  trackEvent('anchoring_success', { tx_hash: txHash });
}

export function trackAnchoringError(subStep: string, error: string) {
  trackEvent('anchoring_error', { sub_step: subStep, error });
}

export function trackAnchoringRetry() {
  trackEvent('anchoring_retry');
}

// ============================================
// Step 7: Complete
// ============================================

export function trackSignedPdfDownload() {
  trackEvent('signed_pdf_download');
}

export function trackVerifyOnChainClick(documentHash: string) {
  trackEvent('verify_on_chain_click', { document_hash: documentHash });
}

export function trackSignAnotherDocument() {
  trackEvent('sign_another_document');
}

// ============================================
// Verification Flow
// ============================================

export function trackVerifyFileUpload(fileName: string) {
  trackEvent('verify_file_upload', { file_name: fileName });
}

export function trackVerifyStart(source: 'file_upload' | 'query_param') {
  trackEvent('verify_start', { source });
}

export function trackVerifyResult(result: 'valid' | 'invalid' | 'not_found' | 'revoked', documentHash: string) {
  trackEvent('verify_result', { result, document_hash: documentHash });
}

export function trackVerifyError(error: string) {
  trackEvent('verify_error', { error });
}

export function trackVerifyAnother() {
  trackEvent('verify_another_document');
}

export function trackExplorerLinkClick(txHash: string) {
  trackEvent('explorer_link_click', { tx_hash: txHash });
}
