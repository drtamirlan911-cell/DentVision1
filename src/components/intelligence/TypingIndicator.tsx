import React from 'react';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex gap-2.5"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10">
        <Bot size={16} className="text-dv-gold" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-surface-2 border border-bdr-subtle px-4 py-3">
        <span className="text-sm text-txt-muted">Думаю</span>
        <div className="flex gap-1 ml-1">
          {[0, 0.2, 0.4].map((delay) => (
            <motion.span
              key={delay}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay }}
              className="w-1.5 h-1.5 rounded-full bg-dv-gold"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
