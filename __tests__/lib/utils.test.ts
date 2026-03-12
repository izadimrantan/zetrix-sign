import { describe, it, expect } from 'vitest';
import { truncateAddress, formatTimestamp } from '@/lib/utils';

describe('truncateAddress', () => {
  it('truncates long addresses with default lengths', () => {
    const address = 'ZTX3S4ntGLTJw9vVNpCX6Ash6wZhaLLV9BS5S';
    const result = truncateAddress(address);
    expect(result).toBe('ZTX3S4n...V9BS5S');
  });

  it('returns short addresses unchanged', () => {
    const short = 'ZTX3S4n';
    expect(truncateAddress(short)).toBe(short);
  });

  it('uses custom start and end lengths', () => {
    const address = 'ZTX3S4ntGLTJw9vVNpCX6Ash6wZhaLLV9BS5S';
    const result = truncateAddress(address, 10, 10);
    // Address: ZTX3S4ntGLTJw9vVNpCX6Ash6wZhaLLV9BS5S (37 chars)
    // First 10: ZTX3S4ntGL, Last 10: haLLV9BS5S
    expect(result).toBe('ZTX3S4ntGL...haLLV9BS5S');
    expect(result.startsWith('ZTX3S4ntGL')).toBe(true);
    expect(result.endsWith('haLLV9BS5S')).toBe(true);
  });

  it('handles empty string', () => {
    expect(truncateAddress('')).toBe('');
  });
});

describe('formatTimestamp', () => {
  it('converts Unix timestamp to locale string', () => {
    const timestamp = 1710000000; // March 2024
    const result = formatTimestamp(timestamp);
    // Should be a non-empty string
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('handles timestamp 0', () => {
    const result = formatTimestamp(0);
    expect(result).toBeTruthy();
  });
});
