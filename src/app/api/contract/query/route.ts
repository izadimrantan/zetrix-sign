import { NextRequest, NextResponse } from 'next/server';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ZETRIX_CONTRACT_ADDRESS!;
const NODE_URL = process.env.ZETRIX_NODE_URL!;
const MICROSERVICE_URL = process.env.NEXT_PUBLIC_MICROSERVICE_BASE_URL;
const MICROSERVICE_TOKEN = process.env.MICROSERVICE_AUTH_TOKEN;

async function queryViaSDK(method: string, params?: Record<string, unknown>) {
  const ZtxChainSDK = (await import('zetrix-sdk-nodejs')).default;
  const sdk = new ZtxChainSDK({ host: NODE_URL });

  const result = await sdk.contract.call({
    optType: 2,
    contractAddress: CONTRACT_ADDRESS,
    input: JSON.stringify({ method, params: params || {} }),
  });

  if (result.errorCode !== 0) {
    throw new Error(result.errorDesc || `SDK query failed: code ${result.errorCode}`);
  }

  // Parse the query_rets result
  const queryRets = result.result?.query_rets;
  if (queryRets && queryRets.length > 0) {
    const parsed = JSON.parse(queryRets[0].result);
    return parsed;
  }

  throw new Error('Empty response from contract query');
}

async function queryViaMicroservice(method: string, params?: Record<string, unknown>) {
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
      method,
      inputParameters: params || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Microservice query failed: ${response.status}`);
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const { method, params } = await request.json();

    if (!method) {
      return NextResponse.json({ success: false, error: 'method is required' }, { status: 400 });
    }

    let data: unknown;
    try {
      data = await queryViaSDK(method, params);
    } catch (sdkError) {
      console.warn('[contract/query] SDK failed, trying microservice fallback:', sdkError);
      data = await queryViaMicroservice(method, params);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
