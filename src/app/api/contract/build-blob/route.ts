import { NextRequest, NextResponse } from 'next/server';

const NODE_URL = process.env.ZETRIX_NODE_URL!;

export async function POST(request: NextRequest) {
  try {
    const { sourceAddress, contractAddress, input } = await request.json();

    if (!sourceAddress || !contractAddress || !input) {
      return NextResponse.json(
        { success: false, error: 'sourceAddress, contractAddress, and input are required' },
        { status: 400 }
      );
    }

    const ZtxChainSDK = (await import('zetrix-sdk-nodejs')).default;
    const sdk = new ZtxChainSDK({ host: NODE_URL });

    // Get nonce
    const nonceResult = await sdk.account.getNonce(sourceAddress);
    if (nonceResult.errorCode !== 0) {
      throw new Error(nonceResult.errorDesc || 'Failed to get nonce');
    }
    const nonce = (nonceResult.result?.nonce ?? 0) + 1;

    // Build contract invoke operation
    const operationResult = await sdk.operation.contractInvokeByGasOperation({
      sourceAddress,
      contractAddress,
      amount: '0',
      input,
    });
    if (operationResult.errorCode !== 0) {
      throw new Error(operationResult.errorDesc || 'Failed to build operation');
    }

    // Build transaction blob
    const blobResult = await sdk.transaction.buildBlob({
      sourceAddress,
      gasPrice: '1000',
      feeLimit: '1000000',
      nonce: String(nonce),
      operations: [operationResult.result.operation],
    });
    if (blobResult.errorCode !== 0) {
      throw new Error(blobResult.errorDesc || 'Failed to build transaction blob');
    }

    return NextResponse.json({
      success: true,
      transactionBlob: blobResult.result.transactionBlob,
      hash: blobResult.result.hash,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
