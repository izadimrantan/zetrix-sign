import { NextRequest, NextResponse } from 'next/server';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ZETRIX_CONTRACT_ADDRESS!;
const NODE_URL = process.env.ZETRIX_NODE_URL!;
const MICROSERVICE_URL = process.env.NEXT_PUBLIC_MICROSERVICE_BASE_URL;
const MICROSERVICE_TOKEN = process.env.MICROSERVICE_AUTH_TOKEN;

async function validateViaSDK(documentHash: string) {
  const ZtxChainSDK = (await import('zetrix-sdk-nodejs')).default;
  const sdk = new ZtxChainSDK({ host: NODE_URL });

  const result = await sdk.contract.call({
    optType: 2,
    contractAddress: CONTRACT_ADDRESS,
    input: JSON.stringify({ method: 'isValidated', params: { documentHash } }),
  });

  if (result.errorCode !== 0) {
    throw new Error(result.errorDesc || 'SDK validation query failed');
  }

  const queryRets = result.result?.query_rets;
  if (queryRets && queryRets.length > 0) {
    return JSON.parse(queryRets[0].result);
  }

  throw new Error('Empty response from validation query');
}

async function validateViaMicroservice(documentHash: string) {
  if (!MICROSERVICE_URL || !MICROSERVICE_TOKEN) {
    throw new Error('Microservice not configured');
  }

  const response = await fetch(`${MICROSERVICE_URL}/ztx/contract/query-address`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MICROSERVICE_TOKEN}`,
    },
    body: JSON.stringify({
      address: CONTRACT_ADDRESS,
      method: 'isValidated',
      inputParameters: { documentHash },
    }),
  });

  if (!response.ok) throw new Error(`Microservice failed: ${response.status}`);
  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const { documentHash } = await request.json();

    if (!documentHash || typeof documentHash !== 'string' || documentHash.length !== 64) {
      return NextResponse.json(
        { success: false, error: 'documentHash must be a 64-character hex string' },
        { status: 400 }
      );
    }

    let data: unknown;
    try {
      data = await validateViaSDK(documentHash);
    } catch (sdkError) {
      console.warn('[contract/validate] SDK failed, trying fallback:', sdkError);
      data = await validateViaMicroservice(documentHash);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
