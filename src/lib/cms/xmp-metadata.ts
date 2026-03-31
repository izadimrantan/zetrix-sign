import type { VcXmpParams, AnchorXmpParams } from '@/types/cms';

const ZETRIX_NS = 'https://zetrix.com/ns/pdfsig/1.0/';

/**
 * XML-escape a string for use in attribute values.
 */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Build an XMP packet wrapping the given rdf:Description attributes.
 */
function wrapXmpPacket(attributes: string): string {
  return [
    '<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    `    <rdf:Description rdf:about=""`,
    `      xmlns:zetrix="${ZETRIX_NS}"`,
    attributes,
    '    />',
    '  </rdf:RDF>',
    '</x:xmpmeta>',
    '<?xpacket end="w"?>',
  ].join('\n');
}

/**
 * Format an array of key-value pairs as XMP attribute lines.
 */
function formatAttributes(entries: [string, string][]): string {
  return entries
    .map(([key, value]) => `      zetrix:${key}="${xmlEscape(value)}"`)
    .join('\n');
}

/**
 * Build VC identity XMP (embedded before CMS signing).
 */
export function buildVcXmp(params: VcXmpParams): string {
  const entries: [string, string][] = [
    ['SignerName', params.signerName],
    ['SignerDID', params.signerDid],
    ['SignerAddress', params.signerAddress],
    ['CredentialId', params.credentialId],
    ['CredentialIssuer', params.credentialIssuer],
    ['VCVerifiedAt', params.vcVerifiedAt],
    ['SignatureStandard', 'CMS-PKCS7'],
    ['AnchorVersion', '2.0'],
  ];
  return wrapXmpPacket(formatAttributes(entries));
}

/**
 * Build anchor XMP (appended after CMS signing via incremental update).
 */
export function buildAnchorXmp(params: AnchorXmpParams): string {
  const entries: [string, string][] = [
    ['DocumentHash', params.documentHash],
    ['HashAlgorithm', params.hashAlgorithm],
    ['HashScope', params.hashScope],
    ['AnchorTxHash', params.txHash],
    ['AnchorBlockNumber', String(params.blockNumber)],
    ['AnchorTimestamp', params.blockTimestamp],
    ['AnchorChainId', params.chainId],
    ['VerificationURL', params.verificationUrl],
  ];
  return wrapXmpPacket(formatAttributes(entries));
}

/**
 * Merge new XMP properties into existing PDF XMP metadata.
 * If existingXmp is null or empty, creates a fresh XMP packet.
 * Otherwise, inserts zetrix namespace properties into the existing rdf:Description.
 */
export function mergeXmpIntoExisting(
  existingXmp: string | null,
  newXmpProperties: string
): string {
  if (!existingXmp || existingXmp.trim() === '') {
    // Wrap the new properties in a full XMP packet
    return wrapXmpPacket(newXmpProperties);
  }

  // Check if the zetrix namespace is already declared
  const hasZetrixNs = existingXmp.includes(ZETRIX_NS);

  // Try to find an existing rdf:Description to augment
  const descriptionPattern = /<rdf:Description([^>]*)\/?>/;
  const match = existingXmp.match(descriptionPattern);

  if (match) {
    const existingAttrs = match[1];
    const nsDecl = hasZetrixNs
      ? ''
      : `\n      xmlns:zetrix="${ZETRIX_NS}"`;

    // Remove any existing zetrix: attributes to avoid duplicates
    const cleanedAttrs = existingAttrs.replace(
      /\s*zetrix:\w+="[^"]*"/g,
      ''
    );

    // Check if it was a self-closing tag
    const isSelfClosing = match[0].endsWith('/>');
    const closingStr = isSelfClosing ? '/>' : '>';

    const newDescription = `<rdf:Description${cleanedAttrs}${nsDecl}\n${newXmpProperties}\n    ${closingStr}`;
    return existingXmp.replace(descriptionPattern, newDescription);
  }

  // No rdf:Description found — inject one before </rdf:RDF>
  const rdfClose = '</rdf:RDF>';
  if (existingXmp.includes(rdfClose)) {
    const injection = [
      `    <rdf:Description rdf:about=""`,
      `      xmlns:zetrix="${ZETRIX_NS}"`,
      newXmpProperties,
      '    />',
    ].join('\n');
    return existingXmp.replace(rdfClose, `${injection}\n  ${rdfClose}`);
  }

  // Fallback: cannot parse existing XMP, return a fresh packet
  return wrapXmpPacket(newXmpProperties);
}

// Re-export the escape helper for testing
export { xmlEscape };
