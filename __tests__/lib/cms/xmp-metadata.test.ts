import { describe, it, expect } from 'vitest';
import {
  buildVcXmp,
  buildAnchorXmp,
  mergeXmpIntoExisting,
  xmlEscape,
} from '@/lib/cms/xmp-metadata';
import type { VcXmpParams, AnchorXmpParams } from '@/types/cms';

const ZETRIX_NS = 'https://zetrix.com/ns/pdfsig/1.0/';

const sampleVcParams: VcXmpParams = {
  signerName: 'John Tan',
  signerDid: 'did:zetrix:ZTX3abc123',
  signerAddress: 'ZTX3abc123',
  credentialId: 'vc-001',
  credentialIssuer: 'did:zetrix:ZTXissuer456',
  vcVerifiedAt: '2026-03-30T12:00:00Z',
};

const sampleAnchorParams: AnchorXmpParams = {
  documentHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  hashAlgorithm: 'SHA-256',
  hashScope: 'cms-signed-document',
  txHash: '0xdeadbeef1234',
  blockNumber: 42,
  blockTimestamp: '2026-03-30T12:05:00Z',
  chainId: 'zetrix-testnet',
  verificationUrl: 'https://explorer.zetrix.com/tx/0xdeadbeef1234',
};

describe('xmlEscape', () => {
  it('escapes ampersands', () => {
    expect(xmlEscape('A & B')).toBe('A &amp; B');
  });

  it('escapes double quotes', () => {
    expect(xmlEscape('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes angle brackets', () => {
    expect(xmlEscape('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes single quotes', () => {
    expect(xmlEscape("it's")).toBe('it&apos;s');
  });

  it('handles combined special characters', () => {
    expect(xmlEscape('A & "B" <C>')).toBe('A &amp; &quot;B&quot; &lt;C&gt;');
  });
});

describe('buildVcXmp', () => {
  it('produces a valid XMP packet with xpacket markers', () => {
    const xmp = buildVcXmp(sampleVcParams);
    expect(xmp).toContain('<?xpacket begin=');
    expect(xmp).toContain('<?xpacket end="w"?>');
  });

  it('includes the zetrix namespace declaration', () => {
    const xmp = buildVcXmp(sampleVcParams);
    expect(xmp).toContain(`xmlns:zetrix="${ZETRIX_NS}"`);
  });

  it('includes all VC properties', () => {
    const xmp = buildVcXmp(sampleVcParams);
    expect(xmp).toContain('zetrix:SignerName="John Tan"');
    expect(xmp).toContain('zetrix:SignerDID="did:zetrix:ZTX3abc123"');
    expect(xmp).toContain('zetrix:SignerAddress="ZTX3abc123"');
    expect(xmp).toContain('zetrix:CredentialId="vc-001"');
    expect(xmp).toContain('zetrix:CredentialIssuer="did:zetrix:ZTXissuer456"');
    expect(xmp).toContain('zetrix:VCVerifiedAt="2026-03-30T12:00:00Z"');
    expect(xmp).toContain('zetrix:SignatureStandard="CMS-PKCS7"');
    expect(xmp).toContain('zetrix:AnchorVersion="2.0"');
  });

  it('includes rdf:RDF and rdf:Description structure', () => {
    const xmp = buildVcXmp(sampleVcParams);
    expect(xmp).toContain('<rdf:RDF');
    expect(xmp).toContain('<rdf:Description');
    expect(xmp).toContain('rdf:about=""');
  });

  it('XML-escapes special characters in signer name', () => {
    const params: VcXmpParams = {
      ...sampleVcParams,
      signerName: 'O\'Brien & "Associates"',
    };
    const xmp = buildVcXmp(params);
    expect(xmp).toContain('zetrix:SignerName="O&apos;Brien &amp; &quot;Associates&quot;"');
    // Must not contain unescaped raw ampersand or quotes inside the attribute
    expect(xmp).not.toContain('zetrix:SignerName="O\'Brien');
  });
});

describe('buildAnchorXmp', () => {
  it('produces a valid XMP packet', () => {
    const xmp = buildAnchorXmp(sampleAnchorParams);
    expect(xmp).toContain('<?xpacket begin=');
    expect(xmp).toContain('<?xpacket end="w"?>');
  });

  it('includes all anchor properties', () => {
    const xmp = buildAnchorXmp(sampleAnchorParams);
    expect(xmp).toContain(`zetrix:DocumentHash="${sampleAnchorParams.documentHash}"`);
    expect(xmp).toContain('zetrix:HashAlgorithm="SHA-256"');
    expect(xmp).toContain('zetrix:HashScope="cms-signed-document"');
    expect(xmp).toContain('zetrix:AnchorTxHash="0xdeadbeef1234"');
    expect(xmp).toContain('zetrix:AnchorBlockNumber="42"');
    expect(xmp).toContain('zetrix:AnchorTimestamp="2026-03-30T12:05:00Z"');
    expect(xmp).toContain('zetrix:AnchorChainId="zetrix-testnet"');
    expect(xmp).toContain('zetrix:VerificationURL="https://explorer.zetrix.com/tx/0xdeadbeef1234"');
  });

  it('includes the zetrix namespace declaration', () => {
    const xmp = buildAnchorXmp(sampleAnchorParams);
    expect(xmp).toContain(`xmlns:zetrix="${ZETRIX_NS}"`);
  });

  it('converts blockNumber to string', () => {
    const xmp = buildAnchorXmp({ ...sampleAnchorParams, blockNumber: 99999 });
    expect(xmp).toContain('zetrix:AnchorBlockNumber="99999"');
  });
});

describe('mergeXmpIntoExisting', () => {
  const newProperties = '      zetrix:SignerName="Alice"';

  it('creates a new XMP packet when existingXmp is null', () => {
    const result = mergeXmpIntoExisting(null, newProperties);
    expect(result).toContain('<?xpacket begin=');
    expect(result).toContain('zetrix:SignerName="Alice"');
    expect(result).toContain(`xmlns:zetrix="${ZETRIX_NS}"`);
  });

  it('creates a new XMP packet when existingXmp is empty string', () => {
    const result = mergeXmpIntoExisting('', newProperties);
    expect(result).toContain('<?xpacket begin=');
    expect(result).toContain('zetrix:SignerName="Alice"');
  });

  it('merges into existing XMP with rdf:Description', () => {
    const existing = [
      '<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>',
      '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
      '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
      '    <rdf:Description rdf:about=""',
      '      xmlns:dc="http://purl.org/dc/elements/1.1/"',
      '      dc:title="Test PDF"',
      '    />',
      '  </rdf:RDF>',
      '</x:xmpmeta>',
      '<?xpacket end="w"?>',
    ].join('\n');

    const result = mergeXmpIntoExisting(existing, newProperties);
    // Preserves existing attributes
    expect(result).toContain('dc:title="Test PDF"');
    // Adds new zetrix properties
    expect(result).toContain('zetrix:SignerName="Alice"');
    // Adds namespace declaration
    expect(result).toContain(`xmlns:zetrix="${ZETRIX_NS}"`);
    // Keeps overall XMP structure
    expect(result).toContain('<?xpacket begin=');
    expect(result).toContain('</rdf:RDF>');
  });

  it('replaces existing zetrix properties to avoid duplicates', () => {
    const existing = [
      '<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>',
      '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
      '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
      `    <rdf:Description rdf:about=""`,
      `      xmlns:zetrix="${ZETRIX_NS}"`,
      '      zetrix:SignerName="OldName"',
      '    />',
      '  </rdf:RDF>',
      '</x:xmpmeta>',
      '<?xpacket end="w"?>',
    ].join('\n');

    const result = mergeXmpIntoExisting(existing, newProperties);
    expect(result).toContain('zetrix:SignerName="Alice"');
    // Old value should be removed
    expect(result).not.toContain('zetrix:SignerName="OldName"');
  });

  it('injects rdf:Description when RDF exists but Description is missing', () => {
    const existing = [
      '<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>',
      '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
      '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
      '  </rdf:RDF>',
      '</x:xmpmeta>',
      '<?xpacket end="w"?>',
    ].join('\n');

    const result = mergeXmpIntoExisting(existing, newProperties);
    expect(result).toContain('zetrix:SignerName="Alice"');
    expect(result).toContain(`xmlns:zetrix="${ZETRIX_NS}"`);
    expect(result).toContain('</rdf:RDF>');
  });
});
