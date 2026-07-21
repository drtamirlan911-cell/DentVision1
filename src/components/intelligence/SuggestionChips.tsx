import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({ suggestions, onSelect, disabled }: SuggestionChipsProps) {
  if (!suggestions.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="flex flex-wrap gap-2 justify-center"
    >
      {suggestions.slice(0, 6).map((suggestion, i) => (
        <motion.button
          key={suggestion}
          onClick={() => !disabled && onSelect(suggestion)}
          disabled={disabled}
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            delay: i * 0.06,
            duration: 0.3,
            ease: [0.23, 1, 0.32, 1],
          }}
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.96 }}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-medium',
            'bg-white/[0.035] border border-white/[0.08] text-txt-secondary',
            'hover:border-dv-gold/35 hover:text-dv-gold-light hover:bg-dv-gold/[0.08]',
            'hover:shadow-[0_0_24px_rgba(201,169,110,0.1)]',
            'transition-all duration-200',
            disabled && 'opacity-40 cursor-not-allowed'
          )}
        >
          <Sparkles size={11} className="opacity-50" />
          {suggestion}
        </motion.button>
      ))}
    </motion.div>
  );
}
