import { describe, expect, it } from 'vitest';
import { isAcceptedFilePayload } from './fileValidation.js';

function file(originalname: string, mimetype: string, bytes: Buffer | string) {
  return {
    originalname,
    mimetype,
    buffer: Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes),
  };
}

describe('isAcceptedFilePayload', () => {
  it('requires matching extension, MIME and JPEG signature', () => {
    expect(isAcceptedFilePayload(file('x.jpg', 'image/jpeg', [0xff, 0xd8, 0xff, 0x00] as any))).toBe(true);
    expect(isAcceptedFilePayload(file('x.jpg', 'image/png', [0xff, 0xd8, 0xff, 0x00] as any))).toBe(false);
    expect(isAcceptedFilePayload(file('x.pdf', 'application/pdf', [0xff, 0xd8, 0xff, 0x00] as any))).toBe(false);
  });

  it('accepts common image and PDF signatures', () => {
    expect(isAcceptedFilePayload(file('x.png', 'image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))).toBe(true);
    expect(isAcceptedFilePayload(file('x.gif', 'image/gif', 'GIF89a'))).toBe(true);
    expect(isAcceptedFilePayload(file('x.webp', 'image/webp', 'RIFF0000WEBP'))).toBe(true);
    expect(isAcceptedFilePayload(file('x.pdf', 'application/pdf', '%PDF-1.7'))).toBe(true);
  });

  it('requires ZIP signatures for OOXML and a DICM marker for DICOM', () => {
    expect(isAcceptedFilePayload(file('x.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', [0x50, 0x4b, 0x03, 0x04] as any))).toBe(true);
    const dicom = Buffer.alloc(132);
    dicom.write('DICM', 128, 'ascii');
    expect(isAcceptedFilePayload(file('x.dcm', 'application/dicom', dicom))).toBe(true);
    expect(isAcceptedFilePayload(file('x.dcm', 'application/dicom', Buffer.from('not a DICOM file')))).toBe(false);
  });

  it('rejects unknown extensions and arbitrary text disguised as a PDF', () => {
    expect(isAcceptedFilePayload(file('x.exe', 'application/octet-stream', 'MZ'))).toBe(false);
    expect(isAcceptedFilePayload(file('x.pdf', 'application/pdf', 'patient note without PDF header'))).toBe(false);
  });
});
