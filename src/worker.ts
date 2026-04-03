import { MiniElfParser } from './lib/miniElf';
import { AOBScanner } from './lib/scanner';
import { LIBRARY_SIGNATURES } from './constants/signatures';

let isCancelled = false;

self.onmessage = async (e: MessageEvent) => {
  const { file, action } = e.data;

  if (action === 'cancel') {
    isCancelled = true;
    return;
  }

  isCancelled = false;
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

  try {
    self.postMessage({ type: 'progress', message: 'Reading ELF header...', progress: 5 });
    
    const headerBlob = file.slice(0, 8192);
    const headerBuffer = await headerBlob.arrayBuffer();
    
    const miniParser = new MiniElfParser(headerBuffer);
    await processElf(file, miniParser, file.name);

  } catch (err) {
    if (isCancelled) {
      self.postMessage({ type: 'error', message: 'Operation cancelled.' });
    } else {
      self.postMessage({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'An unknown error occurred' 
      });
    }
  }
};

async function processElf(file: Blob, miniParser: MiniElfParser, fileName: string) {
  const CHUNK_SIZE = 5 * 1024 * 1024;
  const { shoff, shnum, shentsize, shstrndx } = miniParser.getSectionHeadersInfo();
  const is64 = miniParser.is64;
  const isLittleEndian = miniParser.isLittleEndian;

  let signatures = LIBRARY_SIGNATURES[fileName] || [];
  if (signatures.length === 0) {
    const key = Object.keys(LIBRARY_SIGNATURES).find(k => fileName.includes(k));
    if (key) signatures = LIBRARY_SIGNATURES[key];
  }

  self.postMessage({ type: 'progress', message: `Analyzing ${fileName}...`, progress: 5 });

  const shBlob = file.slice(shoff, shoff + (shnum * shentsize));
  const shBuffer = await shBlob.arrayBuffer();
  const shView = new DataView(shBuffer);

  const shstrtabEntryOffset = shstrndx * shentsize;
  const shstrtabOffset = is64 ? Number(shView.getBigUint64(shstrtabEntryOffset + 24, isLittleEndian)) : shView.getUint32(shstrtabEntryOffset + 16, isLittleEndian);
  const shstrtabSize = is64 ? Number(shView.getBigUint64(shstrtabEntryOffset + 32, isLittleEndian)) : shView.getUint32(shstrtabEntryOffset + 20, isLittleEndian);

  const shstrtabBlob = file.slice(shstrtabOffset, shstrtabOffset + shstrtabSize);
  const shstrtabBuffer = await shstrtabBlob.arrayBuffer();

  const sections = MiniElfParser.parseSections(shBuffer, shstrtabBuffer, shnum, shentsize, is64, isLittleEndian);
  
  const foundOffsets: Record<string, string[]> = {};
  const allStrings: { text: string; offset: number }[] = [];
  const sectionEntropies: Record<string, number> = {};
  let detectedVersion = 'Unknown';
  let isPacked = false;
  const imports: string[] = [];
  const functionPrologues: number[] = [];
  const callGraph: { caller: number; callee: number }[] = [];
  const stringXrefs: Record<string, number[]> = {};

  // 1. Entropy Analysis & Packing Detection (NON-BLOCKING)
  for (const section of sections) {
    if (section.size > 0 && section.size < 100 * 1024 * 1024) {
      const sBlob = file.slice(section.offset, section.offset + section.size);
      const sBuf = await sBlob.arrayBuffer();
      const entropy = calculateEntropy(new Uint8Array(sBuf));
      sectionEntropies[section.name] = entropy;
      if (entropy > 7.5 && section.name !== '.text') isPacked = true;
    }
  }

  // 2. Extract Imports (Dynamic Symbols)
  const dynsym = sections.find(s => s.name === '.dynsym');
  const dynstr = sections.find(s => s.name === '.dynstr');
  if (dynsym && dynstr) {
    const symBlob = file.slice(dynsym.offset, dynsym.offset + dynsym.size);
    const strBlob = file.slice(dynstr.offset, dynstr.offset + dynstr.size);
    const symBuf = await symBlob.arrayBuffer();
    const strBuf = await strBlob.arrayBuffer();
    const symView = new DataView(symBuf);
    const strArray = new Uint8Array(strBuf);
    
    const entrySize = is64 ? 24 : 16;
    for (let i = 0; i < dynsym.size; i += entrySize) {
      const nameIdx = symView.getUint32(i, isLittleEndian);
      if (nameIdx === 0) continue;
      
      let name = '';
      for (let j = nameIdx; j < strArray.length && strArray[j] !== 0; j++) {
        name += String.fromCharCode(strArray[j]);
      }
      if (name) imports.push(name);
    }
  }

  // 3. Global Deep Scan (Full File)
  self.postMessage({ type: 'progress', message: 'Performing Deep Scan (Full File)...', progress: 20 });
  
  const totalSize = file.size;
  const textSection = sections.find(s => s.name === '.text');
  const rodataSection = sections.find(s => s.name === '.rodata');
  
  for (let offset = 0; offset < totalSize; offset += CHUNK_SIZE) {
    if (isCancelled) throw new Error('Cancelled');

    const currentChunkSize = Math.min(CHUNK_SIZE + 1024, totalSize - offset);
    const chunkBlob = file.slice(offset, offset + currentChunkSize);
    const chunkBuffer = await chunkBlob.arrayBuffer();
    const chunkData = new Uint8Array(chunkBuffer);
    const chunkView = new DataView(chunkBuffer);
    
    self.postMessage({ 
      type: 'progress', 
      message: `Deep Scanning (${Math.floor((offset / totalSize) * 100)}%)...`, 
      progress: 20 + Math.floor((offset / totalSize) * 70)
    });

    // AOB Scan
    const scanner = new AOBScanner(chunkBuffer);
    for (const sig of signatures) {
      const matches = scanner.scan(sig.pattern);
      if (matches.length > 0) {
        if (!foundOffsets[sig.name]) foundOffsets[sig.name] = [];
        matches.forEach(m => {
          const hexOff = `0x${(offset + m).toString(16).toUpperCase()}`;
          if (!foundOffsets[sig.name].includes(hexOff)) foundOffsets[sig.name].push(hexOff);
        });
      }
    }

    // String Extraction
    let currentStr = '';
    let strStart = 0;
    for (let i = 0; i < chunkData.length; i++) {
      const b = chunkData[i];
      if (b >= 32 && b <= 126) {
        if (currentStr === '') strStart = offset + i;
        currentStr += String.fromCharCode(b);
      } else {
        if (currentStr.length >= 4) {
          if (allStrings.length < 10000) {
            allStrings.push({ text: currentStr, offset: strStart });
            if (currentStr.match(/\d+\.\d+\.\d+/)) detectedVersion = currentStr;
          }
        }
        currentStr = '';
      }
    }

    // ARM64 Instruction Scanning (Prologue, BL, ADRP/ADD heuristic)
    for (let i = 0; i < chunkData.length - 4; i += 4) {
      const ins = chunkView.getUint32(i, true);
      
      // Prologue: stp x29, x30, [sp, -0x10]! -> 0xA9BF7BFD
      if (ins === 0xA9BF7BFD) {
        functionPrologues.push(offset + i);
      }

      // BL: 0x94000000 -> 0x97FFFFFF
      if ((ins & 0xFC000000) === 0x94000000) {
        let imm = (ins & 0x03FFFFFF);
        if (imm & 0x02000000) imm |= 0xFC000000; // Sign extend
        const target = (offset + i) + (imm << 2);
        callGraph.push({ caller: offset + i, callee: target });
      }

      // Heuristic String XREF (ADRP + ADD/LDR)
      // ADRP: 0x90000000 mask 0x9F000000
      if ((ins & 0x9F000000) === 0x90000000) {
        const nextIns = chunkView.getUint32(i + 4, true);
        // ADD (imm): 0x91000000 mask 0xFF000000
        if ((nextIns & 0xFF000000) === 0x91000000) {
          // Simplified target calculation
          // In a real tool, we'd calculate the exact address, but here we'll just mark it as a potential XREF
          // We'll search if this address points to any of our extracted strings
        }
      }
    }
  }

  self.postMessage({
    type: 'success',
    data: {
      fileName,
      foundOffsets,
      strings: allStrings.slice(0, 5000),
      version: detectedVersion,
      entropies: sectionEntropies,
      imports: imports.slice(0, 1000),
      prologues: functionPrologues.slice(0, 2000),
      callGraph: callGraph.slice(0, 5000),
      isPacked,
      recommendations: generateRecommendations(fileName, foundOffsets, allStrings.map(s => s.text), isPacked, imports)
    }
  });
}

function generateRecommendations(lib: string, offsets: any, strings: string[], isPacked: boolean, imports: string[]) {
  const recs: string[] = [];
  if (isPacked) recs.push('CRITICAL: Binary is PACKED/ENCRYPTED. Static offsets may be invalid.');
  if (lib.includes('anogs')) recs.push('Anti-cheat hook detected - Patch recommended.');
  if (lib.includes('TBlueData')) recs.push('Device info collection - Spoof recommended.');
  
  if (imports.includes('ptrace')) recs.push('Anti-debug detected (ptrace) - Patch recommended.');
  if (imports.includes('fopen')) recs.push('File access detected - Monitor for config checks.');

  const keywords = ['device_id', 'mac_address', 'imei', 'root', 'cheat', 'ban'];
  for (const s of strings) {
    const lower = s.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        recs.push(`Security String: "${s}" - Potential detection point.`);
        break;
      }
    }
    if (recs.length > 10) break;
  }
  return recs;
}

function calculateEntropy(data: Uint8Array): number {
  const freqs = new Array(256).fill(0);
  for (const b of data) freqs[b]++;
  let entropy = 0;
  for (const f of freqs) {
    if (f > 0) {
      const p = f / data.length;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}
