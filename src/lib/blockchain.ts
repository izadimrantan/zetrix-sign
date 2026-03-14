import type { ValidationResult, ContractQueryResponse, BuildBlobResponse, SubmitSignedResponse } from '@/types/contract';

/**
 * Generic contract query — calls our API route which proxies to the microservice.
 */
export async function queryContract(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const response = await fetch('/api/contract/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });

  const data: ContractQueryResponse = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Contract query failed');
  }
  return data.data;
}

/**
 * Validate a document hash against the smart contract's isValidated method.
 */
export async function validateDocument(documentHash: string): Promise<ValidationResult> {
  const response = await fetch('/api/contract/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentHash }),
  });

  const data: ContractQueryResponse = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Validation query failed');
  }
  return data.data as ValidationResult;
}

/**
 * Build a transaction blob server-side (for extension wallet flow).
 * Server proxies to the microservice to generate the blob; client then signs it.
 * Returns both the blob and the hash (needed for submit).
 */
export async function buildTransactionBlob(
  sourceAddress: string,
  input: { method: string; params: Record<string, unknown> }
): Promise<{ transactionBlob: string; hash: string }> {
  const response = await fetch('/api/contract/build-blob', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceAddress,
      contractAddress: process.env.NEXT_PUBLIC_ZETRIX_CONTRACT_ADDRESS,
      input: JSON.stringify(input),
    }),
  });

  const data: BuildBlobResponse = await response.json();
  if (!response.ok || !data.success || !data.transactionBlob) {
    throw new Error(data.error || 'Failed to build transaction blob');
  }
  return { transactionBlob: data.transactionBlob, hash: data.hash || '' };
}

/**
 * Submit a wallet-signed blob to the blockchain via the microservice.
 * The hash from build-blob must be forwarded for the microservice to accept the tx.
 */
export async function submitSignedTransaction(
  transactionBlob: string,
  signData: string,
  publicKey: string,
  hash: string,
  sourceAddress: string
): Promise<string> {
  const response = await fetch('/api/contract/submit-signed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionBlob, signData, publicKey, hash, sourceAddress }),
  });

  const data: SubmitSignedResponse = await response.json();
  if (!response.ok || !data.success || !data.hash) {
    throw new Error(data.error || 'Failed to submit signed transaction');
  }
  return data.hash;
}
