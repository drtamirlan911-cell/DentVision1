import React from 'react';
import { Scale } from 'lucide-react';
import { PageHeader } from '@/components/ui/ds/StatCard';

export interface LegalDocSection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
}

interface LegalDocLayoutProps {
  title: string;
  updatedAt: string;
  sections: LegalDocSection[];
}

/**
 * Shared shell for the two public legal documents. Not `prose` — that
 * Tailwind class is referenced elsewhere in the app but the typography
 * plugin was never added to tailwind.config.js, so it renders unstyled;
 * explicit classes here actually apply.
 */
export default function LegalDocLayout({ title, updatedAt, sections }: LegalDocLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-0 max-w-full overflow-x-hidden">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <PageHeader title={title} subtitle={`Обновлено: ${updatedAt}`} icon={<Scale size={20} />} />
        <div className="space-y-7">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-semibold text-txt-primary mb-2">{s.heading}</h2>
              {s.paragraphs?.map((p, i) => (
                <p key={i} className="text-sm text-txt-secondary leading-relaxed mb-2 last:mb-0">
                  {p}
                </p>
              ))}
              {s.list && (
                <ul className="list-disc pl-5 text-sm text-txt-secondary space-y-1.5 mt-2">
                  {s.list.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
