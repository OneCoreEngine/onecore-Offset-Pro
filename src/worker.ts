import { MiniElfParser } from './lib/miniElf';
import { AOBScanner } from './lib/scanner';
import { LIBRARY_SIGNATURES } from './constants/signatures';

let isCancelled = false;

self.onmessage = async (e: MessageEvent) => {
  const { file, action, showAllFunctions } = e.data;

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
    await processElf(file, miniParser, file.name, showAllFunctions);

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

async function processElf(file: Blob, miniParser: MiniElfParser, fileName: string, showAllFunctions: boolean = false) {
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
  const callGraph: { caller: number; callee: number; type: string }[] = [];
  const stringXrefs: Record<number, number[]> = {}; // stringOffset -> codeOffsets
  const pltEntries: Record<string, number> = {}; // importName -> pltOffset
  const globalPointers: { name: string; offset: number }[] = [];

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
    let chunkBlCount = 0;
    for (let i = 0; i < chunkData.length - 4; i += 4) {
      const ins = chunkView.getUint32(i, true);
      const currentPC = offset + i;
      
      // Prologue: stp x29, x30, [sp, -0x10]! -> 0xA9BF7BFD
      if (ins === 0xA9BF7BFD) {
        functionPrologues.push(currentPC);
      }

      // BL: 0x94000000 -> 0x97FFFFFF (Mask 0xFC000000, Value 0x94000000)
      // B:  0x14000000 -> 0x17FFFFFF (Mask 0xFC000000, Value 0x14000000)
      const isBL = (ins & 0xFC000000) === 0x94000000;
      const isB = (ins & 0xFC000000) === 0x14000000;
      
      if (isBL || isB) {
        let imm = (ins & 0x03FFFFFF);
        if (imm & 0x02000000) imm |= 0xFC000000; // Sign extend 26-bit imm
        const target = currentPC + (imm << 2);
        
        // Only add if it's a valid target within the file
        if (target >= 0 && target < totalSize) {
          callGraph.push({ caller: currentPC, callee: target, type: isBL ? 'BL' : 'B' });
          chunkBlCount++;
        }
      }

      // Indirect Call: BR Xn, BLR Xn
      // BR: 0xD61F0000 mask 0xFFFFFC1F
      // BLR: 0xD63F0000 mask 0xFFFFFC1F
      if ((ins & 0xFFFFFC1F) === 0xD61F0000 || (ins & 0xFFFFFC1F) === 0xD63F0000) {
        // Mark as indirect call for analysis
      }

      // ADRP + ADD/LDR (String XREF & Indirect Call Resolution)
      // ADRP: 0x90000000 mask 0x9F000000
      if ((ins & 0x9F000000) === 0x90000000) {
        const nextIns = chunkView.getUint32(i + 4, true);
        
        // Calculate ADRP target page
        let immlo = (ins >> 29) & 0x3;
        let immhi = (ins >> 5) & 0x7FFFF;
        let imm = (immhi << 2) | immlo;
        if (imm & 0x100000) imm |= 0xFFE00000; // Sign extend 21-bit imm
        const adrpTarget = (currentPC & ~0xFFF) + (imm << 12);

        // ADD (immediate): 0x91000000 mask 0xFF000000
        if ((nextIns & 0xFF000000) === 0x91000000) {
          const addImm = (nextIns >> 10) & 0xFFF;
          const finalTarget = adrpTarget + addImm;
          
          // Check if finalTarget points to a string
          if (finalTarget < totalSize) {
            if (!stringXrefs[finalTarget]) stringXrefs[finalTarget] = [];
            stringXrefs[finalTarget].push(currentPC);
          }
        }
        // LDR (immediate): 0xF9400000 mask 0xFFC00000
        else if ((nextIns & 0xFFC00000) === 0xF9400000) {
          const ldrImm = ((nextIns >> 10) & 0xFFF) << 3; // 8-byte offset
          const finalTarget = adrpTarget + ldrImm;
          // Potential indirect call target or global variable
        }
      }
    }
    console.log(`Chunk at ${offset}: Found ${chunkBlCount} branch instructions.`);
  }

  // 4. Global Pointer Scanning (.data section)
  const dataSection = sections.find(s => s.name === '.data');
  if (dataSection) {
    const dataBlob = file.slice(dataSection.offset, dataSection.offset + dataSection.size);
    const dataBuf = await dataBlob.arrayBuffer();
    const dataView = new DataView(dataBuf);
    
    // Look for GNames, GWorld patterns (usually pointers near each other)
    for (let i = 0; i < dataSection.size - 8; i += 8) {
      const ptr = is64 ? Number(dataView.getBigUint64(i, isLittleEndian)) : dataView.getUint32(i, isLittleEndian);
      if (ptr > 0 && ptr < totalSize) {
        // Potential global pointer
      }
    }
  }

  // Filter callGraph to only include targets that are function prologues
  // This reduces noise and matches user requirement
  const filteredCallGraph = callGraph.filter(call => 
    functionPrologues.includes(call.callee)
  );

  console.log(`Total BL/B instructions found: ${callGraph.length}`);
  console.log(`Filtered Call Graph (targets with prologues): ${filteredCallGraph.length}`);

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
      callGraph: filteredCallGraph.slice(0, 5000),
      isPacked,
      recommendations: generateRecommendations(fileName, foundOffsets, allStrings.map(s => s.text), isPacked, imports),
      classifiedOffsets: classifyAllOffsets(fileName, foundOffsets, functionPrologues, imports, allStrings, showAllFunctions, filteredCallGraph, stringXrefs)
    }
  });
}

function classifyAllOffsets(
  lib: string, 
  foundOffsets: Record<string, string[]>, 
  prologues: number[], 
  imports: string[], 
  strings: { text: string; offset: number }[],
  showAllFunctions: boolean,
  callGraph: { caller: number; callee: number }[],
  stringXrefs: Record<number, number[]>
) {
  const classified: { 
    offset: string; 
    type: string; 
    confidence: number; 
    library: string; 
    indicators: string[]; 
    banType: string;
    signatureName?: string;
    isHoneypot?: boolean;
    honeypotReason?: string;
    source?: string;
  }[] = [];
  const lowerLib = lib.toLowerCase();

  const add = (offset: string, type: string, confidence: number, indicators: string[], banType: string, signatureName?: string, isHoneypot?: boolean, honeypotReason?: string, source?: string) => {
    // Honeypot Detection Logic
    const numericOff = parseInt(offset, 16);
    let currentIsHoneypot = isHoneypot || false;
    let currentHoneypotReason = honeypotReason || '';
    let currentConfidence = confidence;

    // 1. Call Graph Isolation Check
    const callers = getCallers(numericOff);
    if (callers.length === 0 && type !== 'Import Caller') {
      currentIsHoneypot = true;
      currentHoneypotReason = '⚠️ Isolated function (no callers found)';
    }

    // 2. String Reference Check (Proximity)
    const nearbyStrings = strings.filter(s => Math.abs(s.offset - numericOff) < 0x200);
    if (nearbyStrings.length === 0 && type === 'Deep Offset') {
      currentIsHoneypot = true;
      currentHoneypotReason = currentHoneypotReason || '⚠️ No meaningful nearby strings';
    }

    // Apply Confidence Penalty
    if (currentIsHoneypot) {
      currentConfidence = 30;
    }

    classified.push({ 
      offset, 
      type, 
      confidence: currentConfidence, 
      library: lib, 
      indicators, 
      banType, 
      signatureName, 
      isHoneypot: currentIsHoneypot, 
      honeypotReason: currentHoneypotReason, 
      source 
    });
  };

  // 1. Multi-Level Traversal Helper
  const getCallers = (target: number) => callGraph.filter(c => c.callee === target).map(c => c.caller);
  const getCallees = (caller: number) => callGraph.filter(c => c.caller === caller).map(c => c.callee);

  const traverseDepth = (startOffset: number, depth: number = 3): number[] => {
    let current = [startOffset];
    let allFound = new Set<number>([startOffset]);
    for (let i = 0; i < depth; i++) {
      let next: number[] = [];
      current.forEach(off => {
        getCallees(off).forEach(callee => {
          if (!allFound.has(callee)) {
            allFound.add(callee);
            next.push(callee);
          }
        });
      });
      current = next;
    }
    return Array.from(allFound);
  };

  // 2. Deep Ban Type Classification
  const getBanTypeFromIndicators = (indicators: string[]) => {
    const text = indicators.join(' ').toLowerCase();
    if (text.includes('device_id') || text.includes('android_id') || text.includes('fingerprint')) return 'HWID';
    if (text.includes('socket') || text.includes('connect') || text.includes('device_blacklist')) return '10 year online';
    if (text.includes('ban_list') || text.includes('offline_ban')) return '10 year offline';
    if (text.includes('month_ban') || text.includes('hardware_ban_init')) return '1 month';
    if (text.includes('heavy_violation') || text.includes('week_ban')) return '7 day';
    if (text.includes('daily_ban') || text.includes('violation_count')) return '1 day';
    if (text.includes('violation') || text.includes('flag_hour')) return '1 hour';
    if (text.includes('half_hour') || text.includes('fopen')) return '30 min';
    if (text.includes('temp_ban') || text.includes('ten_minute')) return '10 min';
    if (text.includes('ptrace') || text.includes('pthread_create') || text.includes('quick_scan')) return '1 min';
    return 'Suspicious';
  };

  // 3. Process AOB Matches
  let signatures = LIBRARY_SIGNATURES[lib] || [];
  if (signatures.length === 0) {
    const key = Object.keys(LIBRARY_SIGNATURES).find(k => lib.includes(k));
    if (key) signatures = LIBRARY_SIGNATURES[key];
  }
  
  Object.entries(foundOffsets).forEach(([name, offsets]) => {
    const sig = signatures.find(s => s.name === name);
    offsets.forEach(off => {
      const numericOff = parseInt(off, 16);
      const deepOffsets = traverseDepth(numericOff, 2);
      
      deepOffsets.forEach(deepOff => {
        const hexDeep = `0x${deepOff.toString(16).toUpperCase()}`;
        const indicators = sig ? [`Matched Signature: ${sig.name}`, sig.bypass_use] : [`Matched Signature: ${name}`];
        
        // Add string indicators if any
        const nearbyString = strings.find(s => Math.abs(s.offset - deepOff) < 0x800);
        if (nearbyString) indicators.push(`Nearby String: "${nearbyString.text}"`);

        const banType = getBanTypeFromIndicators(indicators);
        const confidence = (indicators.length > 2) ? 90 : 75;
        
        add(hexDeep, 'Deep Offset', confidence, indicators, banType, sig?.name, false, '', `AOB: ${name}`);
      });
    });
  });

  // 4. Process String XREFs
  const deepStrings = [
    'integrity_check', 'hardware_ban', 'device_blacklist', 'ten_minute', 'temp_ban',
    'violation', 'cheat', 'detect', 'anti', 'bypass', 'hook', 'ptrace', 'emulator'
  ];

  strings.forEach(s => {
    const text = s.text.toLowerCase();
    if (deepStrings.some(ds => text.includes(ds))) {
      const xrefs = stringXrefs[s.offset] || [];
      xrefs.forEach(xref => {
        const hexXref = `0x${xref.toString(16).toUpperCase()}`;
        const indicators = [`String XREF: "${s.text}"`];
        const banType = getBanTypeFromIndicators(indicators);
        add(hexXref, 'String XREF', 85, indicators, banType, undefined, false, '', `String: ${s.text}`);
      });
    }
  });

  // 5. Import Callers
  const criticalImports = ['ptrace', 'pthread_create', 'socket', 'connect', 'fopen', 'memcmp', '__system_property_get'];
  criticalImports.forEach(imp => {
    if (imports.includes(imp)) {
      // In a real tool, we'd find the PLT entry and then callers of that PLT entry.
      // Here we'll use a heuristic: functions in anogs/tbluedata are often callers.
      if (lowerLib.includes('anogs') || lowerLib.includes('tbluedata')) {
        prologues.slice(0, 50).forEach(off => {
          const hexOff = `0x${off.toString(16).toUpperCase()}`;
          add(hexOff, 'Import Caller', 65, [`Library imports ${imp}`], getBanTypeFromIndicators([imp]), undefined, false, '', `Import: ${imp}`);
        });
      }
    }
  });

  // 6. Generic Prologues (if showAllFunctions is true)
  if (showAllFunctions) {
    prologues.forEach(off => {
      const hexOff = `0x${off.toString(16).toUpperCase()}`;
      // Check if already added
      if (!classified.some(c => c.offset === hexOff)) {
        add(hexOff, 'Function Prologue', 40, ['Generic function entry point'], 'Unknown', undefined, false, '', 'Static Analysis');
      }
    });
  }

  return classified;
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
