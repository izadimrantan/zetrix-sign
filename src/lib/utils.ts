import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui class merge helper */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Truncate a wallet address for display: ZTX3S4n...V9BS5S */
export function truncateAddress(address: string, startLen = 7, endLen = 6): string {
  if (address.length <= startLen + endLen) return address;
  return `${address.slice(0, startLen)}...${address.slice(-endLen)}`;
}

/** Format a Unix timestamp to readable UTC date string.
 *  Handles seconds, milliseconds, microseconds, and string values from the contract. */
export function formatTimestamp(timestamp: number | string): string {
  const ts = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
  if (!ts || isNaN(ts)) return 'Unknown';

  let ms: number;
  if (ts > 1e15) {
    // Microseconds (16+ digits, e.g. 1776806324000000)
    ms = ts / 1000;
  } else if (ts > 1e12) {
    // Milliseconds (13+ digits)
    ms = ts;
  } else {
    // Seconds (10 digits)
    ms = ts * 1000;
  }

  const date = new Date(ms);
  if (isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';
}
