import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ZETRIX_CONTRACT_ADDRESS!;
const MICROSERVICE_URL = process.env.MICROSERVICE_BASE_URL;
const MICROSERVICE_TOKEN = process.env.MICROSERVICE_AUTH_TOKEN;
const MICROSERVICE_API_KEY = process.env.MICROSERVICE_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { documentHash } = await request.json();

    if (!documentHash || typeof documentHash !== 'string' || documentHash.length !== 64) {
      return NextResponse.json(
        { success: false, error: 'documentHash must be a 64-character hex string' },
        { status: 400 }
      );
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
        method: 'isValidated',
        inputParameters: { documentHash },
      }),
    });

    if (!response.ok) {
      throw new Error(`Microservice validation query failed: ${response.status}`);
    }

    const result = await response.json();
    // Microservice returns: { result: { type: "string", value: "<JSON string>" } }
    // We need to parse the nested JSON string into a proper ValidationResult object
    const rawValue = result?.result?.value || result?.object?.result?.value;
    let data = result;
    if (rawValue && typeof rawValue === 'string') {
      data = JSON.parse(rawValue);
    }

    // Look up the txHash from the sessions DB (not stored in the contract)
    if (data.isValid) {
      try {
        const session = await prisma.signingSession.findFirst({
          where: { documentHash },
          select: { txHash: true },
        });
        if (session?.txHash) {
          data.txHash = session.txHash;
        }
      } catch {
        // DB lookup failure is non-critical — continue without txHash
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
