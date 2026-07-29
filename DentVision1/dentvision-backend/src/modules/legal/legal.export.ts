import prisma from '../../lib/prisma.js';
import { writeAuditLog } from './legal.audit.js';

export async function exportDocument(documentId: string, format: string, performedBy: string) {
  const doc = await prisma.legalDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error('Document not found');
  await writeAuditLog({ documentId, action: 'EXPORTED', diff: { format }, performedBy });
  switch (format) {
    case 'html':
      return { content: doc.content, contentType: 'text/html' };
    case 'json':
      return { content: JSON.stringify({ templateId: doc.templateId, variables: doc.variables, version: doc.version, exportedAt: new Date().toISOString(), content: doc.content }), contentType: 'application/json' };
    case 'pdf':
    case 'docx':
      throw new Error(`Format ${format} requires additional dependencies. Use HTML export instead.`);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}
