/**
 * Lightweight ELF Parser for finding section offsets without loading the whole file.
 */
export interface MiniSection {
  name: string;
  offset: number;
  size: number;
}

export class MiniElfParser {
  private view: DataView;
  public is64: boolean;
  public isLittleEndian: boolean;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    
    // Magic check
    if (this.view.getUint32(0, false) !== 0x7F454C46) {
      throw new Error('Not a valid ELF file');
    }

    this.is64 = this.view.getUint8(4) === 2;
    this.isLittleEndian = this.view.getUint8(5) === 1;
  }

  public getSectionHeadersInfo() {
    const shoff = this.is64 ? Number(this.view.getBigUint64(40, this.isLittleEndian)) : this.view.getUint32(32, this.isLittleEndian);
    const shnum = this.view.getUint16(this.is64 ? 60 : 48, this.isLittleEndian);
    const shentsize = this.view.getUint16(this.is64 ? 58 : 46, this.isLittleEndian);
    const shstrndx = this.view.getUint16(this.is64 ? 62 : 50, this.isLittleEndian);

    return { shoff, shnum, shentsize, shstrndx };
  }

  /**
   * Parse sections from a buffer that contains the Section Header Table
   * @param shBuffer Buffer containing the SHT
   * @param shstrtabBuffer Buffer containing the section name string table
   */
  public static parseSections(
    shBuffer: ArrayBuffer, 
    shstrtabBuffer: ArrayBuffer, 
    shnum: number, 
    shentsize: number, 
    is64: boolean, 
    isLittleEndian: boolean
  ): MiniSection[] {
    const shView = new DataView(shBuffer);
    const strView = new Uint8Array(shstrtabBuffer);
    const sections: MiniSection[] = [];

    for (let i = 0; i < shnum; i++) {
      const entryOffset = i * shentsize;
      const nameIndex = shView.getUint32(entryOffset, isLittleEndian);
      const offset = is64 ? Number(shView.getBigUint64(entryOffset + 24, isLittleEndian)) : shView.getUint32(entryOffset + 16, isLittleEndian);
      const size = is64 ? Number(shView.getBigUint64(entryOffset + 32, isLittleEndian)) : shView.getUint32(entryOffset + 20, isLittleEndian);

      // Extract name from strtab
      let name = '';
      for (let j = nameIndex; j < strView.length && strView[j] !== 0; j++) {
        name += String.fromCharCode(strView[j]);
      }

      sections.push({ name, offset, size });
    }

    return sections;
  }
}
