import { NextRequest, NextResponse } from 'next/server';

const MICROSERVICE_URL = process.env.MICROSERVICE_BASE_URL;
const MICROSERVICE_TOKEN = process.env.MICROSERVICE_AUTH_TOKEN;
const MICROSERVICE_API_KEY = process.env.MICROSERVICE_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { sourceAddress, contractAddress, input } = await request.json();

    if (!sourceAddress || !contractAddress || !input) {
      return NextResponse.json(
        { success: false, error: 'sourceAddress, contractAddress, and input are required' },
        { status: 400 }
      );
    }

    if (!MICROSERVICE_URL || !MICROSERVICE_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Microservice not configured' },
        { status: 500 }
      );
    }

    // Parse the input JSON to extract method and params for the microservice
    const parsed = JSON.parse(input);
    const method = parsed.method;
    const inputParameters = parsed.params || {};

    const response = await fetch(`${MICROSERVICE_URL}/ztx/contract/generate-blob`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MICROSERVICE_TOKEN}`,
        'x-api-key': `${MICROSERVICE_API_KEY}`
      },
      body: JSON.stringify({
        txInitiator: sourceAddress,
        sourceAddress,
        contractAddress: contractAddress,
        method,
        inputParameters,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Microservice blob generation failed (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    const blob = result.object?.blob || result.blob;
    const hash = result.object?.hash || result.hash;

    if (!blob) {
      throw new Error('No blob returned from microservice');
    }

    return NextResponse.json({
      success: true,
      transactionBlob: blob,
      hash: hash || '',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
