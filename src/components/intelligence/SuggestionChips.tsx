import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({ suggestions, onSelect, disabled }: SuggestionChipsProps) {
  if (!suggestions.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap gap-1.5 px-1"
    >
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          disabled={disabled}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs border transition-colors',
            'bg-white/5 border-bdr-subtle text-txt-secondary',
            'hover:border-dv-gold hover:text-dv-gold hover:bg-dv-gold/5',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {s}
        </button>
      ))}
    </motion.div>
  );
}
