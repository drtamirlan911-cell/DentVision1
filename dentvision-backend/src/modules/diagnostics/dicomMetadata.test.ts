import { describe, expect, it } from 'vitest';
import { parseDicomPart10Metadata } from './dicomMetadata.js';

const SOP_CLASS = '1.2.840.10008.5.1.4.1.1.2';
const SOP_INSTANCE = '1.2.826.0.1.3680043.10.543.1001';
const STUDY = '1.2.826.0.1.3680043.10.543.2001';
const SERIES = '1.2.826.0.1.3680043.10.543.3001';

function padded(value: string, pad: number): Buffer {
  const raw = Buffer.from(value, 'ascii');
  return raw.length % 2 ? Buffer.concat([raw, Buffer.from([pad])]) : raw;
}

function explicitElement(group: number, element: number, vr: string, value: Buffer): Buffer {
  const longVr = ['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'UC', 'UR', 'UT', 'UN'].includes(vr);
  const header = Buffer.alloc(longVr ? 12 : 8);
  header.writeUInt16LE(group, 0);
  header.writeUInt16LE(element, 2);
  header.write(vr, 4, 2, 'ascii');
  if (longVr) header.writeUInt32LE(value.length, 8);
  else header.writeUInt16LE(value.length, 6);
  return Buffer.concat([header, value]);
}

function implicitElement(group: number, element: number, value: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt16LE(group, 0);
  header.writeUInt16LE(element, 2);
  header.writeUInt32LE(value.length, 4);
  return Buffer.concat([header, value]);
}

function elementTag(group: number, element: number, length: number): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt16LE(group, 0);
  header.writeUInt16LE(element, 2);
  header.writeUInt32LE(length, 4);
  return header;
}

function fileMeta(transferSyntax = '1.2.840.10008.1.2.1'): Buffer {
  const rest = Buffer.concat([
    explicitElement(0x0002, 0x0001, 'OB', Buffer.from([0, 1])),
    explicitElement(0x0002, 0x0002, 'UI', padded(SOP_CLASS, 0)),
    explicitElement(0x0002, 0x0003, 'UI', padded(SOP_INSTANCE, 0)),
    explicitElement(0x0002, 0x0010, 'UI', padded(transferSyntax, 0)),
    explicitElement(0x0002, 0x0012, 'UI', padded('1.2.826.0.1.3680043.10.543', 0)),
  ]);
  const groupLength = Buffer.alloc(4);
  groupLength.writeUInt32LE(rest.length, 0);
  return Buffer.concat([
    explicitElement(0x0002, 0x0000, 'UL', groupLength),
    rest,
  ]);
}

function part10Dataset(options: { transferSyntax?: string; includeSequence?: boolean; mediaUidMismatch?: boolean } = {}): Buffer {
  const { transferSyntax = '1.2.840.10008.1.2.1', includeSequence = false, mediaUidMismatch = false } = options;
  const meta = fileMeta(transferSyntax);
  const preamble = Buffer.alloc(132);
  preamble.write('DICM', 128, 4, 'ascii');
  const common = [
    explicitElement(0x0008, 0x0016, 'UI', padded(SOP_CLASS, 0)),
    explicitElement(0x0008, 0x0018, 'UI', padded(SOP_INSTANCE, 0)),
    explicitElement(0x0008, 0x0020, 'DA', padded('20261122', 0x20)),
    explicitElement(0x0008, 0x0030, 'TM', padded('103015', 0x20)),
    explicitElement(0x0008, 0x0050, 'SH', padded('ACC-1001', 0x20)),
    explicitElement(0x0008, 0x0060, 'CS', padded('CT', 0x20)),
    explicitElement(0x0020, 0x000d, 'UI', padded(STUDY, 0)),
    explicitElement(0x0020, 0x000e, 'UI', padded(SERIES, 0)),
    explicitElement(0x0020, 0x0011, 'IS', padded('1', 0x20)),
    explicitElement(0x0020, 0x0013, 'IS', padded('3', 0x20)),
    explicitElement(0x0028, 0x0010, 'US', Buffer.from([0x00, 0x02])),
    explicitElement(0x0028, 0x0011, 'US', Buffer.from([0x00, 0x02])),
    explicitElement(0x0028, 0x0100, 'US', Buffer.from([0x10, 0x00])),
  ];
  if (includeSequence) {
    const sequence = Buffer.concat([
      explicitElement(0x0008, 0x1111, 'SQ', Buffer.alloc(0)),
      elementTag(0xfffe, 0xe000, 0xffffffff),
      explicitElement(0x0008, 0x1150, 'UI', padded(SOP_CLASS, 0)),
      elementTag(0xfffe, 0xe00d, 0),
      elementTag(0xfffe, 0xe0dd, 0),
    ]);
    // Replace the SQ header length with the DICOM undefined-length marker.
    sequence.writeUInt32LE(0xffffffff, 8);
    common.unshift(sequence);
  }
  const pixelData = explicitElement(0x7fe0, 0x0010, 'OW', Buffer.from([1, 2, 3, 4]));
  const bytes = Buffer.concat([preamble, meta, ...common, pixelData]);
  if (mediaUidMismatch) {
    const marker = Buffer.from(SOP_INSTANCE, 'ascii');
    const position = bytes.indexOf(marker);
    if (position >= 0) bytes[position] = '9'.charCodeAt(0);
  }
  return bytes;
}

describe('DICOM Part 10 metadata parser', () => {
  it('extracts study, series, SOP, modality and image geometry without copying pixel data', () => {
    const metadata = parseDicomPart10Metadata(part10Dataset());
    expect(metadata).toMatchObject({
      transferSyntaxUid: '1.2.840.10008.1.2.1',
      studyInstanceUid: STUDY,
      seriesInstanceUid: SERIES,
      sopInstanceUid: SOP_INSTANCE,
      sopClassUid: SOP_CLASS,
      modality: 'CT',
      studyDate: '20261122',
      studyTime: '103015',
      accessionNumber: 'ACC-1001',
      seriesNumber: '1',
      instanceNumber: '3',
      rows: 512,
      columns: 512,
      bitsAllocated: 16,
    });
    expect(metadata).not.toHaveProperty('patientName');
    expect(metadata).not.toHaveProperty('patientId');
  });

  it('skips undefined-length metadata sequences before reading study identifiers', () => {
    expect(parseDicomPart10Metadata(part10Dataset({ includeSequence: true })).studyInstanceUid).toBe(STUDY);
  });

  it('supports the standard implicit-VR little-endian dataset transfer syntax', () => {
    const meta = fileMeta('1.2.840.10008.1.2');
    const preamble = Buffer.alloc(132);
    preamble.write('DICM', 128, 4, 'ascii');
    const fields = [
      [0x0008, 0x0016, padded(SOP_CLASS, 0)],
      [0x0008, 0x0018, padded(SOP_INSTANCE, 0)],
      [0x0020, 0x000d, padded(STUDY, 0)],
      [0x0020, 0x000e, padded(SERIES, 0)],
    ] as const;
    return expect(parseDicomPart10Metadata(Buffer.concat([
      preamble,
      meta,
      ...fields.map(([group, element, value]) => implicitElement(group, element, value)),
    ])).studyInstanceUid).toBe(STUDY);
  });

  it('rejects non-Part-10 payloads, unsupported syntax and truncated element values', () => {
    expect(() => parseDicomPart10Metadata(Buffer.from('not a dicom file'))).toThrow(/Part 10/i);
    expect(() => parseDicomPart10Metadata(part10Dataset({ transferSyntax: '1.2.840.10008.1.2.1.99' }))).toThrow(/Unsupported/i);
    const source = part10Dataset();
    const studyUid = Buffer.from(STUDY, 'ascii');
    const studyOffset = source.indexOf(studyUid);
    expect(studyOffset).toBeGreaterThan(0);
    const truncated = source.subarray(0, studyOffset + studyUid.length - 2);
    expect(() => parseDicomPart10Metadata(truncated)).toThrow();
  });

  it('rejects media-storage identifiers that disagree with the dataset', () => {
    expect(() => parseDicomPart10Metadata(part10Dataset({ mediaUidMismatch: true }))).toThrow(/do not match/i);
  });

  it('rejects truncated uncompressed Pixel Data and validates encapsulated sequence delimiters', () => {
    const uncompressed = part10Dataset();
    const pixelTag = Buffer.from([0xe0, 0x7f, 0x10, 0x00]);
    const pixelOffset = uncompressed.indexOf(pixelTag);
    expect(pixelOffset).toBeGreaterThan(0);
    expect(() => parseDicomPart10Metadata(uncompressed.subarray(0, uncompressed.length - 2))).toThrow(/Pixel Data is truncated/i);

    const pixelHeader = Buffer.alloc(12);
    pixelHeader.writeUInt16LE(0x7fe0, 0);
    pixelHeader.writeUInt16LE(0x0010, 2);
    pixelHeader.write('OB', 4, 2, 'ascii');
    pixelHeader.writeUInt32LE(0xffffffff, 8);
    const item = elementTag(0xfffe, 0xe000, 4);
    const delimiter = elementTag(0xfffe, 0xe0dd, 0);
    const encapsulated = Buffer.concat([
      uncompressed.subarray(0, pixelOffset),
      pixelHeader,
      item,
      Buffer.from([1, 2, 3, 4]),
      delimiter,
    ]);
    expect(parseDicomPart10Metadata(encapsulated).sopInstanceUid).toBe(SOP_INSTANCE);
    expect(() => parseDicomPart10Metadata(encapsulated.subarray(0, encapsulated.length - 8))).toThrow(/closing delimiter/i);
  });
});
