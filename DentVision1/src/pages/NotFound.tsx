import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileQuestion, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8"
    >
      <FileQuestion size={64} className="text-dv-gold/40" />
      <h1 className="text-4xl font-bold text-txt-primary">404</h1>
      <p className="text-lg text-txt-secondary text-center max-w-md">
        Страница не найдена
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-lg bg-dv-gold px-5 py-2.5 text-sm font-medium text-surface-0 hover:bg-dv-gold/90 transition-colors"
      >
        <Home size={16} />
        На главную
      </Link>
    </motion.div>
  )
}
