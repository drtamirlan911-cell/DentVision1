import React from 'react';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2.5"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10">
        <Bot size={16} className="text-dv-gold" />
      </div>
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className="flex items-center gap-1 px-4 py-2.5 rounded-2xl bg-surface-2 border border-bdr-subtle"
      >
        <motion.span
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
          className="h-2 w-2 rounded-full bg-dv-gold/60"
        />
        <motion.span
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
          className="h-2 w-2 rounded-full bg-dv-gold/60"
        />
        <motion.span
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
          className="h-2 w-2 rounded-full bg-dv-gold/60"
        />
      </motion.div>
    </motion.div>
  );
}