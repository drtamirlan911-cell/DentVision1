import { motion } from 'framer-motion';
import { Card } from '@/components/ui/ds/Card';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Construction } from 'lucide-react';

export function DiagnosticsPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-txt-primary">{title}</h1>
        <p className="text-sm text-txt-muted mt-0.5">{description}</p>
      </div>
      <GlassCard padding="md">
        <div className="flex items-center justify-center h-48 text-txt-muted text-sm flex-col gap-3">
          <Construction size={48} className="opacity-30" />
          <span>Модуль в разработке</span>
        </div>
      </GlassCard>
    </motion.div>
  );
}
