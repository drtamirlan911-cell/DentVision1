import path from 'node:path';

export function isAcceptedFilePayload(file: { originalname: string; mimetype: string; buffer: Buffer }): boolean {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase().split(';')[0].trim();
  const buffer = file.buffer;
  const startsWith = (signature: number[]) => signature.every((byte, index) => buffer[index] === byte);
  const textStart = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').replace(/^\uFEFF/, '').trimStart().toLowerCase();
  const genericMime = ['application/octet-stream', 'binary/octet-stream', 'application/zip'].includes(mime);

  const signatures: Record<string, () => boolean> = {
    '.jpg': () => startsWith([0xff, 0xd8, 0xff]),
    '.jpeg': () => startsWith([0xff, 0xd8, 0xff]),
    '.png': () => startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    '.gif': () => ['GIF87a', 'GIF89a'].some((sig) => buffer.subarray(0, 6).toString('ascii') === sig),
    '.webp': () => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
    '.pdf': () => buffer.subarray(0, 5).toString('ascii') === '%PDF-',
    '.doc': () => startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    '.xls': () => startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    '.docx': () => startsWith([0x50, 0x4b, 0x03, 0x04]),
    '.xlsx': () => startsWith([0x50, 0x4b, 0x03, 0x04]),
    '.dcm': () => buffer.length >= 132 && buffer.toString('ascii', 128, 132) === 'DICM',
    '.dicom': () => buffer.length >= 132 && buffer.toString('ascii', 128, 132) === 'DICM',
    '.stl': () => (textStart.startsWith('solid') && textStart.includes('facet normal') && textStart.includes('vertex')) ||
      (buffer.length >= 84 && buffer.readUInt32LE(80) > 0 && 84 + buffer.readUInt32LE(80) * 50 <= buffer.length),
    '.obj': () => /(?:^|\n)\s*(?:v|vn|vt|f)\s+-?\d/.test(buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8')),
  };
  if (!signatures[ext] || !signatures[ext]()) return false;

  const allowedMimes: Record<string, string[]> = {
    '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'], '.png': ['image/png'],
    '.gif': ['image/gif'], '.webp': ['image/webp'], '.pdf': ['application/pdf'],
    '.doc': ['application/msword'], '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    '.xls': ['application/vnd.ms-excel'], '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    '.dcm': ['application/dicom', 'application/dicom+json'], '.dicom': ['application/dicom', 'application/dicom+json'],
    '.stl': ['model/stl', 'application/sla'], '.obj': ['model/obj', 'text/plain'],
  };
  return genericMime || (allowedMimes[ext]?.includes(mime) ?? false);
}
