import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  color?: string;
  onClick?: () => void;
}

export function ActionCard({ label, description, icon, color = '#C9A96E', onClick }: ActionCardProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 w-full p-3 rounded-xl',
        'bg-surface-2 border border-bdr-subtle hover:border-bdr/50',
        'transition-all duration-200 hover:shadow-md text-left'
      )}
    >
      {icon && (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${color}15`, color }}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-txt-primary truncate">{label}</p>
        {description && (
          <p className="text-xs text-txt-muted truncate">{description}</p>
        )}
      </div>
      <ChevronRight size={14} className="text-txt-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </motion.button>
  );
}
