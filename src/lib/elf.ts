import { Buffer } from 'buffer';

export interface ELFSymbol {
  name: string;
  value: number;
  size: number;
  type: string;
  bind: string;
  visibility: string;
  sectionIndex: number;
}

export interface ELFSection {
  name: string;
  type: string;
  addr: number;
  offset: number;
  size: number;
  flags: string; // Decoded flags (e.g., "WAX")
  flagsRaw: number;
}

export interface ELFSegment {
  type: string;
  offset: number;
  vaddr: number;
  paddr: number;
  filesz: number;
  memsz: number;
  flags: string;
  align: number;
}

export interface ELFRelocation {
  offset: number;
  info: number;
  addend?: number;
  symbolIndex: number;
  type: number;
  symbolName?: string;
  sectionName: string;
}

export interface ELFDynamicEntry {
  tag: string;
  value: number;
  description: string;
}

export interface ELFInfo {
  class: string;
  data: string;
  version: number;
  osAbi: string;
  type: string;
  machine: string;
  entry: string;
}

export class ELFParser {
  private buffer: Buffer;
  private is64Bit: boolean = false;
  private isLittleEndian: boolean = true;
  private headerOffset: number = 0;

  constructor(arrayBuffer: ArrayBuffer) {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('File is empty');
    }
    this.buffer = Buffer.from(arrayBuffer);
    this.headerOffset = this.findElfHeader();
    
    if (this.headerOffset === -1) {
      const startBytes = this.buffer.slice(0, 16);
      const isText = Array.from(startBytes).every(b => (b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9 || b === 0);
      const textPreview = startBytes.toString('utf8').replace(/\0/g, '').trim();
      
      if (isText && textPreview.length > 2) {
        throw new Error(`This file appears to be a text file or a linker script (starts with: "${textPreview}..."). Please upload a compiled binary .so file (ELF binary).`);
      }

      const hex = Array.from(this.buffer.slice(0, 8))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      throw new Error(`Not a valid ELF file. Magic '7f 45 4c 46' not found in the first 4KB. (Found: ${hex}). Please ensure you are uploading a compiled binary, even if renamed.`);
    }

    // Slice buffer to start at ELF header if needed
    if (this.headerOffset > 0) {
      this.buffer = this.buffer.slice(this.headerOffset);
    }

    if (this.buffer.length < 16) {
      throw new Error('ELF header is truncated');
    }

    // ELF Class: 1 = 32-bit, 2 = 64-bit
    if (this.buffer[4] !== 1 && this.buffer[4] !== 2) {
      throw new Error(`Unsupported ELF class: ${this.buffer[4]}. Only 32-bit (1) and 64-bit (2) are supported.`);
    }
    this.is64Bit = this.buffer[4] === 2;
    this.isLittleEndian = this.buffer[5] === 1;
  }

  private findElfHeader(): number {
    // Some files might have leading junk or be part of a container.
    // We search the first 4KB for the ELF magic signature.
    const searchLimit = Math.min(this.buffer.length - 4, 4096);
    for (let i = 0; i < searchLimit; i++) {
      if (this.buffer[i] === 0x7f && 
          this.buffer[i+1] === 0x45 && 
          this.buffer[i+2] === 0x4c && 
          this.buffer[i+3] === 0x46) {
        return i;
      }
    }
    return -1;
  }

  public getBinaryInfo(): ELFInfo {
    const readUInt16 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt16LE(offset) : this.buffer.readUInt16BE(offset);
    const readUInt32 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt32LE(offset) : this.buffer.readUInt32BE(offset);
    const readBigUInt64 = (offset: number) => this.isLittleEndian ? this.buffer.readBigUInt64LE(offset) : this.buffer.readBigUInt64BE(offset);

    const e_type = readUInt16(16);
    const e_machine = readUInt16(18);
    const e_version = readUInt32(20);
    const e_entry = this.is64Bit ? readBigUInt64(24) : readUInt32(24);

    const machines: Record<number, string> = {
      0x00: 'None',
      0x01: 'AT&T WE 32100',
      0x02: 'SPARC',
      0x03: 'x86',
      0x04: 'Motorola 68000',
      0x05: 'Motorola 88000',
      0x07: 'Intel 80860',
      0x08: 'MIPS',
      0x14: 'PowerPC',
      0x15: 'PowerPC 64-bit',
      0x16: 'S390',
      0x28: 'ARM',
      0x32: 'IA-64',
      0x3E: 'x86_64',
      0xB7: 'AArch64',
      0xF3: 'RISC-V'
    };

    const types: Record<number, string> = {
      1: 'Relocatable',
      2: 'Executable',
      3: 'Shared Object',
      4: 'Core'
    };

    const osAbis: Record<number, string> = {
      0: 'System V',
      1: 'HP-UX',
      2: 'NetBSD',
      3: 'Linux',
      6: 'Solaris',
      7: 'AIX',
      8: 'IRIX',
      9: 'FreeBSD',
      10: 'Tru64',
      11: 'Novell Modesto',
      12: 'OpenBSD'
    };

    return {
      class: this.is64Bit ? 'ELF64' : 'ELF32',
      data: this.isLittleEndian ? '2\'s complement, little endian' : '2\'s complement, big endian',
      version: this.buffer[6],
      osAbi: osAbis[this.buffer[7]] || `Unknown (${this.buffer[7]})`,
      type: types[e_type] || `Unknown (${e_type})`,
      machine: machines[e_machine] || `Unknown (${e_machine})`,
      entry: `0x${e_entry.toString(16).toUpperCase()}`
    };
  }

  public getDependencies(): string[] {
    const readUInt16 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt16LE(offset) : this.buffer.readUInt16BE(offset);
    const readUInt32 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt32LE(offset) : this.buffer.readUInt32BE(offset);
    const readBigUInt64 = (offset: number) => this.isLittleEndian ? this.buffer.readBigUInt64LE(offset) : this.buffer.readBigUInt64BE(offset);

    const shoff = this.is64Bit ? Number(readBigUInt64(40)) : readUInt32(32);
    const shentsize = readUInt16(this.is64Bit ? 58 : 46);
    const shnum = readUInt16(this.is64Bit ? 60 : 48);

    let dynamicSection: any = null;
    let dynstrSection: any = null;

    for (let i = 0; i < shnum; i++) {
      const offset = shoff + i * shentsize;
      const type = readUInt32(offset + (this.is64Bit ? 4 : 4));
      if (type === 6) { // SHT_DYNAMIC
        dynamicSection = this.parseSectionHeader(offset);
      }
    }

    if (!dynamicSection) return [];

    // Find .dynstr
    const shstrndx = readUInt16(this.is64Bit ? 62 : 50);
    const shstrtabHeader = this.parseSectionHeader(shoff + shstrndx * shentsize);
    for (let i = 0; i < shnum; i++) {
      const offset = shoff + i * shentsize;
      const header = this.parseSectionHeader(offset);
      let name = '';
      for (let j = Number(shstrtabHeader.offset) + header.nameIndex; j < this.buffer.length && this.buffer[j] !== 0; j++) {
        name += String.fromCharCode(this.buffer[j]);
      }
      if (name === '.dynstr') {
        dynstrSection = header;
        break;
      }
    }

    if (!dynstrSection) return [];

    const deps: string[] = [];
    const entrySize = this.is64Bit ? 16 : 8;
    const numEntries = Math.floor(Number(dynamicSection.size) / entrySize);

    for (let i = 0; i < numEntries; i++) {
      const offset = Number(dynamicSection.offset) + i * entrySize;
      const tag = this.is64Bit ? Number(readBigUInt64(offset)) : readUInt32(offset);
      const val = this.is64Bit ? Number(readBigUInt64(offset + 8)) : readUInt32(offset + 4);

      if (tag === 1) { // DT_NEEDED
        let name = '';
        for (let j = Number(dynstrSection.offset) + val; j < this.buffer.length && this.buffer[j] !== 0; j++) {
          name += String.fromCharCode(this.buffer[j]);
        }
        if (name) deps.push(name);
      }
      if (tag === 0) break; // DT_NULL
    }

    return deps;
  }

  public parse(): ELFSymbol[] {
    return this.getSymbols();
  }

  public getSymbols(): ELFSymbol[] {
    const readUInt16 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt16LE(offset) : this.buffer.readUInt16BE(offset);
    const readUInt32 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt32LE(offset) : this.buffer.readUInt32BE(offset);
    const readBigUInt64 = (offset: number) => this.isLittleEndian ? this.buffer.readBigUInt64LE(offset) : this.buffer.readBigUInt64BE(offset);

    const shoff = this.is64Bit ? Number(readBigUInt64(40)) : readUInt32(32);
    const shentsize = readUInt16(this.is64Bit ? 58 : 46);
    const shnum = readUInt16(this.is64Bit ? 60 : 48);
    const shstrndx = readUInt16(this.is64Bit ? 62 : 50);

    if (shoff === 0 || shnum === 0 || shoff >= this.buffer.length) {
      return [];
    }

    const sections: any[] = [];
    for (let i = 0; i < shnum; i++) {
      sections.push(this.parseSectionHeader(shoff + i * shentsize));
    }

    const shstrtabHeader = sections[shstrndx];
    const getSectionName = (nameIndex: number) => {
      let name = '';
      for (let j = Number(shstrtabHeader.offset) + nameIndex; j < this.buffer.length && this.buffer[j] !== 0; j++) {
        name += String.fromCharCode(this.buffer[j]);
      }
      return name;
    };

    const symbols: ELFSymbol[] = [];
    const symTables = [];

    for (let i = 0; i < shnum; i++) {
      const header = sections[i];
      const name = getSectionName(header.nameIndex);
      if (header.type === 2) { // SHT_SYMTAB
        symTables.push({ header, strHeader: sections.find(s => getSectionName(s.nameIndex) === '.strtab') });
      } else if (header.type === 11) { // SHT_DYNSYM
        symTables.push({ header, strHeader: sections.find(s => getSectionName(s.nameIndex) === '.dynstr') });
      }
    }

    const seenNames = new Set<string>();

    for (const table of symTables) {
      if (!table.header || !table.strHeader) continue;

      const entrySize = this.is64Bit ? 24 : 16;
      const numSymbols = Math.floor(Number(table.header.size) / entrySize);

      for (let i = 0; i < numSymbols; i++) {
        const offset = Number(table.header.offset) + i * entrySize;
        const nameIndex = readUInt32(offset);
        
        let name = '';
        for (let j = Number(table.strHeader.offset) + nameIndex; j < this.buffer.length && this.buffer[j] !== 0; j++) {
          name += String.fromCharCode(this.buffer[j]);
        }

        if (!name) continue;
        
        // Avoid duplicates if both tables have the same symbol
        const uniqueKey = `${name}_${offset}`;
        if (seenNames.has(uniqueKey)) continue;
        seenNames.add(uniqueKey);

        let value, size, info, other, shndx;
        if (this.is64Bit) {
          info = this.buffer[offset + 4];
          other = this.buffer[offset + 5];
          shndx = readUInt16(offset + 6);
          value = Number(readBigUInt64(offset + 8));
          size = Number(readBigUInt64(offset + 16));
        } else {
          value = readUInt32(offset + 4);
          size = readUInt32(offset + 8);
          info = this.buffer[offset + 12];
          other = this.buffer[offset + 13];
          shndx = readUInt16(offset + 14);
        }

        symbols.push({
          name,
          value,
          size,
          type: this.getSymbolType(info & 0xf),
          bind: this.getSymbolBind(info >> 4),
          visibility: this.getSymbolVisibility(other & 0x3),
          sectionIndex: shndx
        });
      }
    }

    return symbols;
  }

  public getSectionHeaderOffset(): number {
    const readUInt32 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt32LE(offset) : this.buffer.readUInt32BE(offset);
    const readBigUInt64 = (offset: number) => this.isLittleEndian ? this.buffer.readBigUInt64LE(offset) : this.buffer.readBigUInt64BE(offset);
    return this.is64Bit ? Number(readBigUInt64(40)) : readUInt32(32);
  }

  public getSectionHeaderCount(): number {
    const readUInt16 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt16LE(offset) : this.buffer.readUInt16BE(offset);
    return readUInt16(this.is64Bit ? 60 : 48);
  }

  public getSectionHeaderEntrySize(): number {
    const readUInt16 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt16LE(offset) : this.buffer.readUInt16BE(offset);
    return readUInt16(this.is64Bit ? 58 : 46);
  }

  public getSectionHeaderStringIndex(): number {
    const readUInt16 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt16LE(offset) : this.buffer.readUInt16BE(offset);
    return readUInt16(this.is64Bit ? 62 : 50);
  }

  public getSections(): ELFSection[] {
    const readUInt16 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt16LE(offset) : this.buffer.readUInt16BE(offset);
    const readUInt32 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt32LE(offset) : this.buffer.readUInt32BE(offset);
    const readBigUInt64 = (offset: number) => this.isLittleEndian ? this.buffer.readBigUInt64LE(offset) : this.buffer.readBigUInt64BE(offset);

    const shoff = this.is64Bit ? Number(readBigUInt64(40)) : readUInt32(32);
    const shentsize = readUInt16(this.is64Bit ? 58 : 46);
    const shnum = readUInt16(this.is64Bit ? 60 : 48);
    const shstrndx = readUInt16(this.is64Bit ? 62 : 50);

    if (shoff === 0 || shnum === 0) return [];

    const shstrtabHeader = this.parseSectionHeader(shoff + shstrndx * shentsize);
    const getSectionName = (nameIndex: number) => {
      let name = '';
      for (let j = Number(shstrtabHeader.offset) + nameIndex; j < this.buffer.length && this.buffer[j] !== 0; j++) {
        name += String.fromCharCode(this.buffer[j]);
      }
      return name;
    };

    const sections: ELFSection[] = [];
    for (let i = 0; i < shnum; i++) {
      const offset = shoff + i * shentsize;
      const header = this.parseSectionHeader(offset);
      sections.push({
        name: getSectionName(header.nameIndex) || `section_${i}`,
        type: this.getSectionType(header.type),
        addr: Number(header.addr),
        offset: Number(header.offset),
        size: Number(header.size),
        flags: this.getSectionFlags(Number(header.flags)),
        flagsRaw: Number(header.flags)
      });
    }
    return sections;
  }

  public getSegments(): ELFSegment[] {
    const readUInt16 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt16LE(offset) : this.buffer.readUInt16BE(offset);
    const readUInt32 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt32LE(offset) : this.buffer.readUInt32BE(offset);
    const readBigUInt64 = (offset: number) => this.isLittleEndian ? this.buffer.readBigUInt64LE(offset) : this.buffer.readBigUInt64BE(offset);

    const phoff = this.is64Bit ? Number(readBigUInt64(32)) : readUInt32(28);
    const phentsize = readUInt16(this.is64Bit ? 54 : 42);
    const phnum = readUInt16(this.is64Bit ? 56 : 44);

    if (phoff === 0 || phnum === 0) return [];

    const segments: ELFSegment[] = [];
    for (let i = 0; i < phnum; i++) {
      const offset = phoff + i * phentsize;
      let type, flagsNum, p_offset, p_vaddr, p_paddr, p_filesz, p_memsz, p_align;

      if (this.is64Bit) {
        type = readUInt32(offset);
        flagsNum = readUInt32(offset + 4);
        p_offset = Number(readBigUInt64(offset + 8));
        p_vaddr = Number(readBigUInt64(offset + 16));
        p_paddr = Number(readBigUInt64(offset + 24));
        p_filesz = Number(readBigUInt64(offset + 32));
        p_memsz = Number(readBigUInt64(offset + 40));
        p_align = Number(readBigUInt64(offset + 48));
      } else {
        type = readUInt32(offset);
        p_offset = readUInt32(offset + 4);
        p_vaddr = readUInt32(offset + 8);
        p_paddr = readUInt32(offset + 12);
        p_filesz = readUInt32(offset + 16);
        p_memsz = readUInt32(offset + 20);
        flagsNum = readUInt32(offset + 24);
        p_align = readUInt32(offset + 28);
      }

      segments.push({
        type: this.getSegmentType(type),
        offset: p_offset,
        vaddr: p_vaddr,
        paddr: p_paddr,
        filesz: p_filesz,
        memsz: p_memsz,
        flags: this.getSegmentFlags(flagsNum),
        align: p_align
      });
    }
    return segments;
  }

  private getSegmentType(type: number): string {
    const types: { [key: number]: string } = {
      0: 'NULL', 1: 'LOAD', 2: 'DYNAMIC', 3: 'INTERP', 4: 'NOTE', 5: 'SHLIB', 6: 'PHDR', 7: 'TLS',
      0x60000000: 'LOOS', 0x6FFFFFFF: 'HIOS', 0x70000000: 'LOPROC', 0x7FFFFFFF: 'HIPROC',
      0x6474e550: 'GNU_EH_FRAME', 0x6474e551: 'GNU_STACK', 0x6474e552: 'GNU_RELRO'
    };
    return types[type] || `0x${type.toString(16)}`;
  }

  private getSegmentFlags(flags: number): string {
    let res = '';
    res += (flags & 0x4) ? 'R' : '-';
    res += (flags & 0x2) ? 'W' : '-';
    res += (flags & 0x1) ? 'X' : '-';
    return res;
  }

  private getSectionType(type: number): string {
    const types: Record<number, string> = {
      0: 'NULL', 1: 'PROGBITS', 2: 'SYMTAB', 3: 'STRTAB', 4: 'RELA', 5: 'HASH',
      6: 'DYNAMIC', 7: 'NOTE', 8: 'NOBITS', 9: 'REL', 10: 'SHLIB', 11: 'DYNSYM'
    };
    return types[type] || 'UNKNOWN';
  }

  private getSectionFlags(flags: number): string {
    let res = '';
    if (flags & 0x1) res += 'W';
    if (flags & 0x2) res += 'A';
    if (flags & 0x4) res += 'X';
    return res || '-';
  }

  public getDynamicEntries(): ELFDynamicEntry[] {
    const readUInt16 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt16LE(offset) : this.buffer.readUInt16BE(offset);
    const readUInt32 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt32LE(offset) : this.buffer.readUInt32BE(offset);
    const readBigUInt64 = (offset: number) => this.isLittleEndian ? this.buffer.readBigUInt64LE(offset) : this.buffer.readBigUInt64BE(offset);

    const shoff = this.is64Bit ? Number(readBigUInt64(40)) : readUInt32(32);
    const shentsize = readUInt16(this.is64Bit ? 58 : 46);
    const shnum = readUInt16(this.is64Bit ? 60 : 48);
    const shstrndx = readUInt16(this.is64Bit ? 62 : 50);

    if (shoff === 0 || shnum === 0) return [];

    const sections: any[] = [];
    for (let i = 0; i < shnum; i++) {
      sections.push(this.parseSectionHeader(shoff + i * shentsize));
    }

    const shstrtabHeader = sections[shstrndx];
    const getSectionName = (nameIndex: number) => {
      let name = '';
      for (let j = Number(shstrtabHeader.offset) + nameIndex; j < this.buffer.length && this.buffer[j] !== 0; j++) {
        name += String.fromCharCode(this.buffer[j]);
      }
      return name;
    };

    const dynamicEntries: ELFDynamicEntry[] = [];
    const dynamicSection = sections.find(s => s.type === 6); // SHT_DYNAMIC
    const dynstrSection = sections.find(s => getSectionName(s.nameIndex) === '.dynstr');

    if (dynamicSection) {
      const entrySize = this.is64Bit ? 16 : 8;
      const numEntries = Math.floor(Number(dynamicSection.size) / entrySize);

      for (let i = 0; i < numEntries; i++) {
        const offset = Number(dynamicSection.offset) + i * entrySize;
        let tag, value;

        if (this.is64Bit) {
          tag = Number(readBigUInt64(offset));
          value = Number(readBigUInt64(offset + 8));
        } else {
          tag = readUInt32(offset);
          value = readUInt32(offset + 4);
        }

        if (tag === 0) break; // DT_NULL

        let description = '';
        if ((tag === 1 || tag === 14 || tag === 15) && dynstrSection) { // DT_NEEDED, DT_SONAME, DT_RPATH
          for (let j = Number(dynstrSection.offset) + value; j < this.buffer.length && this.buffer[j] !== 0; j++) {
            description += String.fromCharCode(this.buffer[j]);
          }
        }

        dynamicEntries.push({
          tag: this.getDynamicTag(tag),
          value,
          description
        });
      }
    }
    return dynamicEntries;
  }

  private getDynamicTag(tag: number): string {
    const tags: { [key: number]: string } = {
      0: 'NULL', 1: 'NEEDED', 2: 'PLTRELSZ', 3: 'PLTGOT', 4: 'HASH', 5: 'STRTAB', 6: 'SYMTAB',
      7: 'RELA', 8: 'RELASZ', 9: 'RELAENT', 10: 'STRSZ', 11: 'SYMENT', 12: 'INIT', 13: 'FINI',
      14: 'SONAME', 15: 'RPATH', 16: 'SYMBOLIC', 17: 'REL', 18: 'RELSZ', 19: 'RELENT', 20: 'PLTREL',
      21: 'DEBUG', 22: 'TEXTREL', 23: 'JMPREL', 24: 'BIND_NOW', 25: 'INIT_ARRAY', 26: 'FINI_ARRAY'
    };
    return tags[tag] || `0x${tag.toString(16)}`;
  }

  public getRelocations(): ELFRelocation[] {
    const readUInt16 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt16LE(offset) : this.buffer.readUInt16BE(offset);
    const readUInt32 = (offset: number) => this.isLittleEndian ? this.buffer.readUInt32LE(offset) : this.buffer.readUInt32BE(offset);
    const readBigUInt64 = (offset: number) => this.isLittleEndian ? this.buffer.readBigUInt64LE(offset) : this.buffer.readBigUInt64BE(offset);

    const shoff = this.is64Bit ? Number(readBigUInt64(40)) : readUInt32(32);
    const shentsize = readUInt16(this.is64Bit ? 58 : 46);
    const shnum = readUInt16(this.is64Bit ? 60 : 48);
    const shstrndx = readUInt16(this.is64Bit ? 62 : 50);

    if (shoff === 0 || shnum === 0) return [];

    const sections: any[] = [];
    for (let i = 0; i < shnum; i++) {
      sections.push(this.parseSectionHeader(shoff + i * shentsize));
    }

    const shstrtabHeader = sections[shstrndx];
    const getSectionName = (nameIndex: number) => {
      let name = '';
      for (let j = Number(shstrtabHeader.offset) + nameIndex; j < this.buffer.length && this.buffer[j] !== 0; j++) {
        name += String.fromCharCode(this.buffer[j]);
      }
      return name;
    };

    const relocations: ELFRelocation[] = [];
    const symbols = this.getSymbols();

    for (let i = 0; i < shnum; i++) {
      const header = sections[i];
      const sectionName = getSectionName(header.nameIndex);
      
      if (header.type === 9 || header.type === 4) { // SHT_REL or SHT_RELA
        const isRela = header.type === 4;
        const entrySize = isRela ? (this.is64Bit ? 24 : 12) : (this.is64Bit ? 16 : 8);
        const numEntries = Math.floor(Number(header.size) / entrySize);

        for (let j = 0; j < numEntries; j++) {
          const offset = Number(header.offset) + j * entrySize;
          let r_offset, r_info, r_addend;

          if (this.is64Bit) {
            r_offset = Number(readBigUInt64(offset));
            r_info = Number(readBigUInt64(offset + 8));
            if (isRela) r_addend = Number(readBigUInt64(offset + 16));
          } else {
            r_offset = readUInt32(offset);
            r_info = readUInt32(offset + 4);
            if (isRela) r_addend = readUInt32(offset + 8);
          }

          const symIdx = this.is64Bit ? Number(BigInt(r_info) >> 32n) : (r_info >> 8);
          const relType = this.is64Bit ? (r_info & 0xFFFFFFFF) : (r_info & 0xFF);

          relocations.push({
            offset: r_offset,
            info: r_info,
            addend: r_addend,
            symbolIndex: symIdx,
            type: relType,
            symbolName: symbols[symIdx]?.name,
            sectionName
          });
        }
      }
    }
    return relocations;
  }
  public getStrings(minLength: number = 4): string[] {
    const strings: string[] = [];
    let currentString = '';

    for (let i = 0; i < this.buffer.length; i++) {
      const charCode = this.buffer[i];
      // Check for printable ASCII characters
      if (charCode >= 32 && charCode <= 126) {
        currentString += String.fromCharCode(charCode);
      } else {
        if (currentString.length >= minLength) {
          strings.push(currentString);
        }
        currentString = '';
      }
    }

    if (currentString.length >= minLength) {
      strings.push(currentString);
    }

    return Array.from(new Set(strings)); // Remove duplicates
  }

  private parseSectionHeader(offset: number) {
    const readUInt32 = (off: number) => this.isLittleEndian ? this.buffer.readUInt32LE(off) : this.buffer.readUInt32BE(off);
    const readBigUInt64 = (off: number) => this.isLittleEndian ? this.buffer.readBigUInt64LE(off) : this.buffer.readBigUInt64BE(off);

    if (this.is64Bit) {
      return {
        nameIndex: readUInt32(offset),
        type: readUInt32(offset + 4),
        flags: readBigUInt64(offset + 8),
        addr: readBigUInt64(offset + 16),
        offset: readBigUInt64(offset + 24),
        size: readBigUInt64(offset + 32),
        link: readUInt32(offset + 40),
        info: readUInt32(offset + 44),
        addralign: readBigUInt64(offset + 48),
        entsize: readBigUInt64(offset + 56),
      };
    } else {
      return {
        nameIndex: readUInt32(offset),
        type: readUInt32(offset + 4),
        flags: readUInt32(offset + 8),
        addr: readUInt32(offset + 12),
        offset: readUInt32(offset + 16),
        size: readUInt32(offset + 20),
        link: readUInt32(offset + 24),
        info: readUInt32(offset + 28),
        addralign: readUInt32(offset + 32),
        entsize: readUInt32(offset + 36),
      };
    }
  }

  private getSymbolType(type: number): string {
    switch (type) {
      case 0: return 'NOTYPE';
      case 1: return 'OBJECT';
      case 2: return 'FUNC';
      case 3: return 'SECTION';
      case 4: return 'FILE';
      case 5: return 'COMMON';
      case 6: return 'TLS';
      default: return 'UNKNOWN';
    }
  }

  private getSymbolBind(bind: number): string {
    switch (bind) {
      case 0: return 'LOCAL';
      case 1: return 'GLOBAL';
      case 2: return 'WEAK';
      default: return 'UNKNOWN';
    }
  }

  private getSymbolVisibility(visibility: number): string {
    switch (visibility) {
      case 0: return 'DEFAULT';
      case 1: return 'INTERNAL';
      case 2: return 'HIDDEN';
      case 3: return 'PROTECTED';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Extract all strings from a section (e.g., .rodata)
   * @param sectionName Name of the section to extract from
   * @param minLength Minimum string length (default 4)
   */
  public getStringsFromSection(sectionName: string = '.rodata', minLength: number = 4): string[] {
    const sections = this.getSections();
    const section = sections.find(s => s.name === sectionName);
    if (!section) return [];

    const data = new Uint8Array(this.buffer.slice(section.offset, section.offset + section.size));
    const strings: string[] = [];
    let currentStr = '';

    for (let i = 0; i < data.length; i++) {
      const b = data[i];
      if (b >= 32 && b <= 126) {
        currentStr += String.fromCharCode(b);
      } else {
        if (currentStr.length >= minLength) {
          strings.push(currentStr);
        }
        currentStr = '';
      }
    }
    if (currentStr.length >= minLength) {
      strings.push(currentStr);
    }

    return strings;
  }

  /**
   * Extract all strings from the entire binary
   */
  public getAllStrings(minLength: number = 4): string[] {
    const data = new Uint8Array(this.buffer);
    const strings: string[] = [];
    let currentStr = '';

    for (let i = 0; i < data.length; i++) {
      const b = data[i];
      if (b >= 32 && b <= 126) {
        currentStr += String.fromCharCode(b);
      } else {
        if (currentStr.length >= minLength) {
          strings.push(currentStr);
        }
        currentStr = '';
      }
    }
    if (currentStr.length >= minLength) {
      strings.push(currentStr);
    }

    return Array.from(new Set(strings)); // Unique strings
  }
}
