-- CreateTable
CREATE TABLE "SigningSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentName" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerDID" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "signatureType" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "digitalSignature" TEXT NOT NULL,
    "signerPublicKey" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "SigningSession_documentHash_key" ON "SigningSession"("documentHash");
