import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({ suggestions, onSelect, disabled }: SuggestionChipsProps) {
  if (!suggestions.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-wrap gap-2"
    >
      {suggestions.slice(0, 4).map((suggestion, i) => (
        <motion.button
          key={suggestion}
          onClick={() => !disabled && onSelect(suggestion)}
          disabled={disabled}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.2 }}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium',
            'bg-surface-2 border border-bdr-subtle text-txt-secondary',
            'hover:border-dv-gold/30 hover:text-dv-gold hover:bg-dv-gold/5',
            'transition-all duration-150',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {suggestion}
        </motion.button>
      ))}
    </motion.div>
  );
}