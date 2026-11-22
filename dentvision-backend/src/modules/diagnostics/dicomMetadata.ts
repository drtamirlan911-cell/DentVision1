export interface DicomPart10Metadata {
  transferSyntaxUid: string;
  studyInstanceUid: string;
  seriesInstanceUid: string;
  sopInstanceUid: string;
  sopClassUid: string;
  modality?: string;
  studyDate?: string;
  studyTime?: string;
  accessionNumber?: string;
  seriesNumber?: string;
  instanceNumber?: string;
  rows?: number;
  columns?: number;
  numberOfFrames?: number;
  bitsAllocated?: number;
  photometricInterpretation?: string;
}

interface ElementHeader {
  group: number;
  element: number;
  vr?: string;
  length: number;
  valueOffset: number;
}

const PREAMBLE_LENGTH = 128;
const LONG_VALUE_VRS = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'UC', 'UR', 'UT', 'UN']);
const TAG = {
  mediaStorageSopClassUid: 0x00020002,
  mediaStorageSopInstanceUid: 0x00020003,
  transferSyntaxUid: 0x00020010,
  sopClassUid: 0x00080016,
  sopInstanceUid: 0x00080018,
  studyDate: 0x00080020,
  studyTime: 0x00080030,
  accessionNumber: 0x00080050,
  modality: 0x00080060,
  studyInstanceUid: 0x0020000d,
  seriesInstanceUid: 0x0020000e,
  seriesNumber: 0x00200011,
  instanceNumber: 0x00200013,
  rows: 0x00280010,
  columns: 0x00280011,
  photometricInterpretation: 0x00280004,
  numberOfFrames: 0x00280008,
  bitsAllocated: 0x00280100,
  pixelData: 0x7fe00010,
} as const;

function tagKey(group: number, element: number): number {
  return (group << 16) | element;
}

function readUInt16(buffer: Buffer, offset: number, littleEndian: boolean): number {
  if (offset < 0 || offset + 2 > buffer.length) throw new Error('DICOM dataset is truncated.');
  return littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
}

function readUInt32(buffer: Buffer, offset: number, littleEndian: boolean): number {
  if (offset < 0 || offset + 4 > buffer.length) throw new Error('DICOM dataset is truncated.');
  return littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
}

function readHeader(
  buffer: Buffer,
  offset: number,
  explicitVr: boolean,
  littleEndian: boolean,
): ElementHeader {
  if (offset < 0 || offset + 8 > buffer.length) throw new Error('DICOM element header is truncated.');
  const group = readUInt16(buffer, offset, littleEndian);
  const element = readUInt16(buffer, offset + 2, littleEndian);
  if (group === 0xfffe) {
    return { group, element, length: readUInt32(buffer, offset + 4, littleEndian), valueOffset: offset + 8 };
  }
  if (!explicitVr) {
    return { group, element, length: readUInt32(buffer, offset + 4, littleEndian), valueOffset: offset + 8 };
  }
  const vr = buffer.toString('ascii', offset + 4, offset + 6);
  if (!/^[A-Z]{2}$/.test(vr)) throw new Error('DICOM element has an invalid explicit VR.');
  if (LONG_VALUE_VRS.has(vr)) {
    if (offset + 12 > buffer.length || buffer[offset + 6] !== 0 || buffer[offset + 7] !== 0) {
      throw new Error('DICOM long-VR element header is invalid.');
    }
    return { group, element, vr, length: readUInt32(buffer, offset + 8, littleEndian), valueOffset: offset + 12 };
  }
  return { group, element, vr, length: readUInt16(buffer, offset + 6, littleEndian), valueOffset: offset + 8 };
}

/**
 * Skip a DICOM undefined-length sequence/item without interpreting its payload.
 * This is only used before Pixel Data while collecting top-level identifiers.
 */
function skipUndefinedContainer(
  buffer: Buffer,
  start: number,
  delimiterElement: number,
  explicitVr: boolean,
  littleEndian: boolean,
  depth = 0,
): number {
  if (depth > 32) throw new Error('DICOM sequence nesting is too deep.');
  let cursor = start;
  while (cursor + 8 <= buffer.length) {
    const group = readUInt16(buffer, cursor, littleEndian);
    const element = readUInt16(buffer, cursor + 2, littleEndian);
    if (group === 0xfffe && element === delimiterElement) return cursor + 8;
    if (group === 0xfffe && element === 0xe000) {
      const itemLength = readUInt32(buffer, cursor + 4, littleEndian);
      if (itemLength === 0xffffffff) {
        cursor = skipUndefinedContainer(buffer, cursor + 8, 0xe00d, explicitVr, littleEndian, depth + 1);
      } else {
        cursor += 8 + itemLength;
      }
      continue;
    }
    const header = readHeader(buffer, cursor, explicitVr, littleEndian);
    if (header.length === 0xffffffff) {
      cursor = skipUndefinedContainer(buffer, header.valueOffset, 0xe0dd, explicitVr, littleEndian, depth + 1);
    } else {
      cursor = header.valueOffset + header.length;
    }
  }
  throw new Error('DICOM undefined-length sequence has no closing delimiter.');
}

function decodeText(buffer: Buffer, offset: number, length: number): string {
  if (length === 0) return '';
  if (length === 0xffffffff || offset < 0 || offset + length > buffer.length) {
    throw new Error('DICOM text value is truncated.');
  }
  return buffer.subarray(offset, offset + length).toString('ascii').replace(/[\0 ]+$/g, '').trim();
}

function validUid(value: string): boolean {
  return value.length > 0 && value.length <= 64 && /^\d+(?:\.\d+)*$/.test(value);
}

function parseOptionalUInt16(buffer: Buffer, offset: number, length: number, littleEndian: boolean): number | undefined {
  if (!length) return undefined;
  if (length !== 2) throw new Error('DICOM US value must be exactly two bytes.');
  return readUInt16(buffer, offset, littleEndian);
}

function parseOptionalInteger(text: string | undefined, label: string): number | undefined {
  if (!text) return undefined;
  if (!/^\d+$/.test(text)) throw new Error(`DICOM ${label} is invalid.`);
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`DICOM ${label} is invalid.`);
  return value;
}

/**
 * Parses only the Part 10 file header and top-level study identifiers.
 * It deliberately does not decode Pixel Data, render images, or claim PACS
 * conformance. Unsupported transfer syntaxes fail closed.
 */
export function parseDicomPart10Metadata(buffer: Buffer): DicomPart10Metadata {
  if (!Buffer.isBuffer(buffer) || buffer.length < PREAMBLE_LENGTH + 4) {
    throw new Error('DICOM Part 10 file is too small.');
  }
  if (buffer.toString('ascii', PREAMBLE_LENGTH, PREAMBLE_LENGTH + 4) !== 'DICM') {
    throw new Error('DICOM Part 10 preamble is missing.');
  }

  let offset = PREAMBLE_LENGTH + 4;
  const fileMeta = new Map<number, string>();
  let groupLength: number | undefined;
  let groupLengthEnd: number | undefined;
  let metaVersion: Buffer | undefined;
  while (offset + 8 <= buffer.length) {
    const header = readHeader(buffer, offset, true, true);
    if (header.group !== 0x0002) break;
    if (header.length === 0xffffffff || header.valueOffset + header.length > buffer.length) {
      throw new Error('DICOM file meta information is malformed.');
    }
    const key = tagKey(header.group, header.element);
    if (key === 0x00020000) {
      if (header.vr !== 'UL' || header.length !== 4) throw new Error('DICOM File Meta Information Group Length is invalid.');
      groupLength = readUInt32(buffer, header.valueOffset, true);
      groupLengthEnd = header.valueOffset + header.length + groupLength;
    } else if (key === 0x00020001) {
      if (header.vr !== 'OB' || header.length !== 2) throw new Error('DICOM File Meta Information Version is invalid.');
      metaVersion = buffer.subarray(header.valueOffset, header.valueOffset + header.length);
    } else if (key === TAG.mediaStorageSopClassUid || key === TAG.mediaStorageSopInstanceUid || key === TAG.transferSyntaxUid || key === 0x00020012) {
      fileMeta.set(key, decodeText(buffer, header.valueOffset, header.length));
    }
    offset = header.valueOffset + header.length;
  }
  if (groupLength === undefined || groupLengthEnd !== offset) {
    throw new Error('DICOM File Meta Information Group Length does not match the meta header.');
  }
  if (!metaVersion || metaVersion.length !== 2 || metaVersion[0] !== 0 || metaVersion[1] !== 1) {
    throw new Error('DICOM File Meta Information Version is missing or invalid.');
  }

  const mediaStorageSopClassUid = fileMeta.get(TAG.mediaStorageSopClassUid) || '';
  const mediaStorageSopInstanceUid = fileMeta.get(TAG.mediaStorageSopInstanceUid) || '';
  const implementationClassUid = fileMeta.get(0x00020012) || '';
  if (!validUid(mediaStorageSopClassUid) || !validUid(mediaStorageSopInstanceUid) || !validUid(implementationClassUid)) {
    throw new Error('DICOM File Meta Information is missing required SOP or implementation identifiers.');
  }
  const transferSyntaxUid = fileMeta.get(TAG.transferSyntaxUid) || '';
  const implicitVr = transferSyntaxUid === '1.2.840.10008.1.2';
  const explicitBigEndian = transferSyntaxUid === '1.2.840.10008.1.2.2';
  const explicitLittleEndian = transferSyntaxUid === '1.2.840.10008.1.2.1'
    || /^1\.2\.840\.10008\.1\.2\.4\.\d+$/.test(transferSyntaxUid)
    || transferSyntaxUid === '1.2.840.10008.1.2.5';
  if (!validUid(transferSyntaxUid) || (!implicitVr && !explicitBigEndian && !explicitLittleEndian)) {
    throw Object.assign(new Error('Unsupported or missing DICOM transfer syntax.'), { code: 'DICOM_TRANSFER_SYNTAX_UNSUPPORTED' });
  }
  const littleEndian = !explicitBigEndian;
  const explicitVr = !implicitVr;
  const values = new Map<number, string | number>();

  while (offset + 8 <= buffer.length) {
    const header = readHeader(buffer, offset, explicitVr, littleEndian);
    const key = tagKey(header.group, header.element);
    if (key === TAG.pixelData) break;
    if (header.length === 0xffffffff) {
      if (header.vr !== 'SQ') throw new Error('Unexpected undefined-length DICOM element before Pixel Data.');
      offset = skipUndefinedContainer(buffer, header.valueOffset, 0xe0dd, explicitVr, littleEndian);
      continue;
    }
    if (header.valueOffset + header.length > buffer.length) throw new Error('DICOM element value is truncated.');
    const wanted = new Set<number>([
      TAG.sopClassUid, TAG.sopInstanceUid, TAG.studyDate, TAG.studyTime,
      TAG.accessionNumber, TAG.modality, TAG.studyInstanceUid, TAG.seriesInstanceUid,
      TAG.seriesNumber, TAG.instanceNumber, TAG.rows, TAG.columns,
      TAG.numberOfFrames, TAG.bitsAllocated, TAG.photometricInterpretation,
    ]);
    if (wanted.has(key)) {
      if (key === TAG.rows || key === TAG.columns || key === TAG.bitsAllocated) {
        values.set(key, parseOptionalUInt16(buffer, header.valueOffset, header.length, littleEndian) ?? 0);
      } else {
        values.set(key, decodeText(buffer, header.valueOffset, header.length));
      }
    }
    offset = header.valueOffset + header.length;
  }

  const required = [
    [TAG.studyInstanceUid, 'Study Instance UID'],
    [TAG.seriesInstanceUid, 'Series Instance UID'],
    [TAG.sopInstanceUid, 'SOP Instance UID'],
    [TAG.sopClassUid, 'SOP Class UID'],
  ] as const;
  for (const [key, label] of required) {
    const value = String(values.get(key) || '');
    if (!validUid(value)) throw new Error(`DICOM ${label} is missing or invalid.`);
  }
  const sopClassUid = String(values.get(TAG.sopClassUid));
  const sopInstanceUid = String(values.get(TAG.sopInstanceUid));
  if (mediaStorageSopClassUid !== sopClassUid || mediaStorageSopInstanceUid !== sopInstanceUid) {
    throw new Error('DICOM file meta SOP identifiers do not match the dataset.');
  }

  const studyDate = String(values.get(TAG.studyDate) || '');
  if (studyDate && !/^\d{8}$/.test(studyDate)) throw new Error('DICOM Study Date is invalid.');
  const studyTime = String(values.get(TAG.studyTime) || '');
  if (studyTime && !/^\d{2}(?:\d{2}(?:\d{2}(?:\.\d{1,6})?)?)?$/.test(studyTime)) throw new Error('DICOM Study Time is invalid.');
  const rows = values.get(TAG.rows) as number | undefined;
  const columns = values.get(TAG.columns) as number | undefined;
  const bitsAllocated = values.get(TAG.bitsAllocated) as number | undefined;
  if (rows !== undefined && (rows < 1 || rows > 65535)) throw new Error('DICOM Rows is invalid.');
  if (columns !== undefined && (columns < 1 || columns > 65535)) throw new Error('DICOM Columns is invalid.');
  if (bitsAllocated !== undefined && ![1, 8, 16, 32, 64].includes(bitsAllocated)) throw new Error('DICOM Bits Allocated is invalid.');

  return {
    transferSyntaxUid,
    studyInstanceUid: String(values.get(TAG.studyInstanceUid)),
    seriesInstanceUid: String(values.get(TAG.seriesInstanceUid)),
    sopInstanceUid,
    sopClassUid,
    ...(values.has(TAG.modality) ? { modality: String(values.get(TAG.modality)) } : {}),
    ...(studyDate ? { studyDate } : {}),
    ...(studyTime ? { studyTime } : {}),
    ...(values.has(TAG.accessionNumber) ? { accessionNumber: String(values.get(TAG.accessionNumber)) } : {}),
    ...(values.has(TAG.seriesNumber) ? { seriesNumber: String(values.get(TAG.seriesNumber)) } : {}),
    ...(values.has(TAG.instanceNumber) ? { instanceNumber: String(values.get(TAG.instanceNumber)) } : {}),
    ...(rows !== undefined ? { rows } : {}),
    ...(columns !== undefined ? { columns } : {}),
    ...(values.has(TAG.numberOfFrames) ? { numberOfFrames: parseOptionalInteger(String(values.get(TAG.numberOfFrames)), 'Number of Frames') } : {}),
    ...(bitsAllocated !== undefined ? { bitsAllocated } : {}),
    ...(values.has(TAG.photometricInterpretation) ? { photometricInterpretation: String(values.get(TAG.photometricInterpretation)) } : {}),
  };
}
