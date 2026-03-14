import { NextRequest, NextResponse } from 'next/server';

const MICROSERVICE_URL = process.env.MICROSERVICE_BASE_URL;
const MICROSERVICE_TOKEN = process.env.MICROSERVICE_AUTH_TOKEN;
const MICROSERVICE_API_KEY = process.env.MICROSERVICE_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { transactionBlob, signData, publicKey, hash, sourceAddress } = await request.json();

    if (!transactionBlob || !signData || !publicKey) {
      return NextResponse.json(
        { success: false, error: 'transactionBlob, signData, publicKey, and hash are required' },
        { status: 400 }
      );
    }

    if (!MICROSERVICE_URL || !MICROSERVICE_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Microservice not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${MICROSERVICE_URL}/ztx/contract/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MICROSERVICE_TOKEN}`,
        'x-api-key': `${MICROSERVICE_API_KEY}`
      },
      body: JSON.stringify({
        txInitiator: sourceAddress,
        blob: transactionBlob,
        listSigner: [{ signBlob: signData, publicKey }],
        hash: hash || '',
      }),
    });

    if (!response.ok) {
      if (response.status === 403) {
        return NextResponse.json(
          { success: false, error: 'Microservice authentication failed. Check MICROSERVICE_AUTH_TOKEN.' },
          { status: 502 }
        );
      }
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Microservice transaction submission failed (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    const txHash = result.object?.hash || result.hash || '';

    return NextResponse.json({
      success: true,
      hash: txHash,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
