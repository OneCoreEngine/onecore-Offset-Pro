/**
 * High-performance AOB (Array of Bytes) Pattern Scanner
 * Supports wildcards (?? or xx)
 */
export class AOBScanner {
  private buffer: Uint8Array;

  constructor(buffer: ArrayBuffer) {
    this.buffer = new Uint8Array(buffer);
  }

  /**
   * Scan for a pattern in the buffer
   * @param pattern Pattern string (e.g., "48 8B 05 ?? ?? ?? ?? 48 8B 88")
   * @returns Array of found offsets
   */
  public scan(pattern: string): number[] {
    const { bytes, mask } = this.parsePattern(pattern);
    const results: number[] = [];
    const bufferLength = this.buffer.length;
    const patternLength = bytes.length;

    if (patternLength === 0 || patternLength > bufferLength) return [];

    // Simple linear scan (could be optimized with Boyer-Moore if needed)
    for (let i = 0; i <= bufferLength - patternLength; i++) {
      let match = true;
      for (let j = 0; j < patternLength; j++) {
        if (mask[j] && this.buffer[i + j] !== bytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        results.push(i);
      }
    }

    return results;
  }

  /**
   * Parse pattern string into bytes and mask
   */
  private parsePattern(pattern: string): { bytes: number[]; mask: boolean[] } {
    const parts = pattern.trim().split(/\s+/);
    const bytes: number[] = [];
    const mask: boolean[] = [];

    for (const part of parts) {
      if (part === '??' || part === 'xx' || part === '?') {
        bytes.push(0);
        mask.push(false);
      } else {
        const byte = parseInt(part, 16);
        if (!isNaN(byte)) {
          bytes.push(byte);
          mask.push(true);
        }
      }
    }

    return { bytes, mask };
  }
}
