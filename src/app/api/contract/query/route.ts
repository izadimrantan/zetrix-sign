import { NextRequest, NextResponse } from 'next/server';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ZETRIX_CONTRACT_ADDRESS!;
const MICROSERVICE_URL = process.env.MICROSERVICE_BASE_URL;
const MICROSERVICE_TOKEN = process.env.MICROSERVICE_AUTH_TOKEN;
const MICROSERVICE_API_KEY = process.env.MICROSERVICE_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { method, params } = await request.json();

    if (!method) {
      return NextResponse.json({ success: false, error: 'method is required' }, { status: 400 });
    }

    if (!MICROSERVICE_URL || !MICROSERVICE_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Microservice not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${MICROSERVICE_URL}/ztx/contract/query-address`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MICROSERVICE_TOKEN}`,
        'x-api-key': `${MICROSERVICE_API_KEY}`
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

    const result = await response.json();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
