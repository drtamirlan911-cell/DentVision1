import { motion } from 'framer-motion';
import { Logo } from '@/components/brand';

/**
 * App-wide route/suspense fallback — a branded splash: the DentVision mark
 * gently pulses above an indeterminate progress bar. Replaces the bare spinner
 * so every lazy screen loads with a premium, on-brand moment.
 */
export function PageLoader() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-5">
      <motion.div
        initial={{ opacity: 0.55, scale: 0.96 }}
        animate={{ opacity: [0.55, 1, 0.55], scale: [0.96, 1, 0.96] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      >
        <Logo variant="icon" height={46} responsive={false} />
      </motion.div>
      <div className="h-1 w-28 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full w-1/3 rounded-full bg-dv-gold"
          animate={{ x: ['-120%', '360%'] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <span className="sr-only">Загрузка…</span>
    </div>
  );
}

export default PageLoader;
