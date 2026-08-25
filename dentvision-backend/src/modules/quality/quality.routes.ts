import { Router } from 'express';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { authenticate } from '../../middleware/auth.js';
import { requirePlatformOps } from '../../middleware/platformOps.js';

/**
 * Quality Center — SuperAdmin-only static scan of the frontend `src/` tree.
 * Deliberately synchronous, fast, pure-filesystem checks only (mirrors
 * quality-scripts/audit.ts's non-subprocess checks). tsc/ts-prune are
 * intentionally excluded here — they're too slow for a request/response cycle.
 */
export const qualityRouter = Router();

qualityRouter.use(authenticate);
qualityRouter.use(requirePlatformOps);

export interface QualityIssue {
  id: string;
  label: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  category: 'Accessibility' | 'Code Quality';
  file: string;
  line?: number;
  description: string;
}

const LARGE_COMPONENT_LINES = 400;

function getAllFiles(dir: string, ext: string): string[] {
  const files: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) {
      files.push(...getAllFiles(p, ext));
    } else if (e.name.endsWith(ext)) {
      files.push(p);
    }
  }
  return files;
}

function dirSizeBytes(dir: string): number | null {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  let total = 0;
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      total += dirSizeBytes(p) || 0;
    } else {
      try { total += statSync(p).size; } catch { /* skip unreadable file */ }
    }
  }
  return total;
}

qualityRouter.post('/scan', (_req, res) => {
  const srcDir = join(process.cwd(), '..', 'src');
  const bundleSizeBytes = dirSizeBytes(join(process.cwd(), '..', 'dist'));
  const tsxFiles = getAllFiles(srcDir, '.tsx');
  const items: QualityIssue[] = [];

  for (const file of tsxFiles) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const rel = file.replace(srcDir, 'src');

    if (lines.length > LARGE_COMPONENT_LINES) {
      items.push({
        id: `size:${rel}`,
        label: `Крупный компонент: ${lines.length} строк`,
        severity: lines.length > LARGE_COMPONENT_LINES * 1.5 ? 'serious' : 'moderate',
        category: 'Code Quality',
        file: rel,
        description: `Файл превышает порог в ${LARGE_COMPONENT_LINES} строк — стоит разбить на подкомпоненты`,
      });
    }

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (
        trimmed.includes('size="icon"') || trimmed.includes("size='icon'") ||
        trimmed.includes('size="icon-sm"') || trimmed.includes("size='icon-sm'")
      ) {
        let context = '';
        for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) context += lines[j] + '\n';
        if (!context.includes('aria-label')) {
          items.push({
            id: `aria:${rel}:${i + 1}`,
            label: 'Иконка-кнопка без aria-label',
            severity: 'serious',
            category: 'Accessibility',
            file: rel,
            line: i + 1,
            description: 'Кнопка с size="icon" без доступного текстового описания для скринридеров',
          });
        }
      }
      if (trimmed.includes('console.log(') && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
        items.push({
          id: `console:${rel}:${i + 1}`,
          label: 'console.log в production-коде',
          severity: 'minor',
          category: 'Code Quality',
          file: rel,
          line: i + 1,
          description: 'Отладочный вывод, оставленный в коде',
        });
      }
      if (trimmed === 'debugger;' || trimmed === 'debugger') {
        items.push({
          id: `debugger:${rel}:${i + 1}`,
          label: 'Оператор debugger',
          severity: 'critical',
          category: 'Code Quality',
          file: rel,
          line: i + 1,
          description: 'Точка останова, оставленная в коде',
        });
      }
    }
  }

  res.json({ ok: true, data: { scannedAt: new Date().toISOString(), filesScanned: tsxFiles.length, items, bundleSizeBytes } });
});
