import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/diagnostics.service.ts'),
  'utf8',
);

describe('diagnostics durable notification and audit PHI contract', () => {
  it('does not interpolate patient names or study types into persisted notification messages', () => {
    const messageLines = source.split(/\r?\n/).filter((line) => /\bmessage\s*:|\bconst message\s*=/.test(line));
    expect(messageLines.join('\n')).not.toMatch(/\bpatientName\b|\bstudyType\b/);
  });

  it('does not copy patient names, study types, file names or free-text reasons into audit metadata', () => {
    const auditDetailLines = source.split(/\r?\n/).filter((line) => /\bdetails\s*:/.test(line));
    expect(auditDetailLines.join('\n')).not.toMatch(/\bpatientName\b|\bstudyType\b|\bfileName\b|\breason\b/);
  });

  it('does not publish patient names or study types in diagnostic domain events', () => {
    const publishLines = source.split(/\r?\n/).filter((line) => /^\s*publish\(/.test(line));
    expect(publishLines.join('\n')).not.toMatch(/\bpatientName\b|\bstudyType\b/);
  });
});


const publicBookingSource = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/public/publicDiagnosticsBooking.routes.ts'),
  'utf8',
);

describe('public diagnostic booking event and notification PHI contract', () => {
  it('publishes only opaque booking references and lifecycle status', () => {
    const eventPayloads = [...publicBookingSource.matchAll(
      /await emit\('diagnostics\\.booking\\.(?:created|status_changed)',\\s*\\{([\\s\\S]*?)\\}\\);/g,
    )].map((match) => match[1]);

    expect(eventPayloads).toHaveLength(2);
    for (const payload of eventPayloads) {
      expect(payload).toMatch(/\\bbookingId\\s*:/);
      expect(payload).not.toMatch(/\\b(?:patientName|patientPhone|studyId|date|time|notes)\\s*:/);
    }
  });

  it('keeps persisted staff notification bodies generic', () => {
    const notificationCalls = [...publicBookingSource.matchAll(
      /await notifyCenterStaff\\([\\s\\S]*?\\);/g,
    )].map((match) => match[0]);

    expect(notificationCalls).toHaveLength(2);
    expect(notificationCalls.join('\\n')).not.toMatch(
      /\\bpatientName\\b|\\bpatientPhone\\b|\\bstudyId\\b|\\bstudy\\.name\\b|updated\\.date/,
    );
  });
});
