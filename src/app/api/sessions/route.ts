import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const required = [
      'documentName', 'walletAddress', 'signerName', 'signerDID',
      'credentialID', 'signatureType', 'documentHash', 'digitalSignature',
      'signerPublicKey', 'txHash',
    ];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    const session = await prisma.signingSession.create({
      data: {
        documentName: body.documentName,
        walletAddress: body.walletAddress,
        signerName: body.signerName,
        signerDID: body.signerDID,
        credentialID: body.credentialID,
        signatureType: body.signatureType,
        documentHash: body.documentHash,
        digitalSignature: body.digitalSignature,
        signerPublicKey: body.signerPublicKey,
        txHash: body.txHash,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    const sessions = await prisma.signingSession.findMany({
      where: walletAddress ? { walletAddress } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
