export const demangle = (name: string) => {
  if (!name.startsWith('_Z')) return name;
  try {
    // Slightly better demangling for common patterns
    let demangled = name.replace(/^_Z+/, '');
    
    // Handle nested names (e.g., _ZN3std6stringE)
    if (demangled.startsWith('N')) {
      demangled = demangled.slice(1);
      const parts = [];
      while (demangled.length > 0) {
        const match = demangled.match(/^(\d+)/);
        if (!match) break;
        const len = parseInt(match[1]);
        const start = match[0].length;
        parts.push(demangled.slice(start, start + len));
        demangled = demangled.slice(start + len);
        if (demangled.startsWith('E')) break;
      }
      return parts.join('::');
    }

    // Fallback for simple names
    return demangled
      .replace(/(\d+)/g, ' ')
      .replace(/v$/g, '()')
      .trim();
  } catch {
    return name;
  }
};

export const isImportantSymbol = (name: string) => {
  const important = ['JNI_OnLoad', 'JNI_OnUnload', 'Java_', 'RegisterNatives', 'main', '_start'];
  return important.some(imp => name.includes(imp));
};

export const calculateEntropy = (buffer: ArrayBuffer) => {
  const data = new Uint8Array(buffer);
  const chunkSize = Math.max(256, Math.floor(data.length / 200)); // Around 200 data points
  const entropyPoints = [];

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const freqs: { [key: number]: number } = {};
    for (const byte of chunk) {
      freqs[byte] = (freqs[byte] || 0) + 1;
    }

    let entropy = 0;
    for (const byte in freqs) {
      const p = freqs[byte] / chunk.length;
      entropy -= p * Math.log2(p);
    }
    entropyPoints.push({ offset: i, entropy });
  }
  return entropyPoints;
};
