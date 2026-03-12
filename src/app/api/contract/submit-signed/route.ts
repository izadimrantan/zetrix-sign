import { NextRequest, NextResponse } from 'next/server';

const NODE_URL = process.env.ZETRIX_NODE_URL!;

export async function POST(request: NextRequest) {
  try {
    const { transactionBlob, signData, publicKey } = await request.json();

    if (!transactionBlob || !signData || !publicKey) {
      return NextResponse.json(
        { success: false, error: 'transactionBlob, signData, and publicKey are required' },
        { status: 400 }
      );
    }

    const ZtxChainSDK = (await import('zetrix-sdk-nodejs')).default;
    const sdk = new ZtxChainSDK({ host: NODE_URL });

    const submitResult = await sdk.transaction.submit({
      items: [{
        transactionBlob,
        signatures: [{ signData, publicKey }],
      }],
    });

    if (submitResult.errorCode !== 0) {
      throw new Error(submitResult.errorDesc || 'Transaction submission failed');
    }

    return NextResponse.json({
      success: true,
      hash: submitResult.result?.hash || '',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
