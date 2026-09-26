import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = i18n.language?.startsWith('kz') ? 'kz' : i18n.language?.startsWith('en') ? 'en' : 'ru';

  const LANGUAGES = [
    { code: 'ru', label: t('platform.language_ru'), full: t('platform.language_ru_full') },
    { code: 'kz', label: t('platform.language_kz'), full: t('platform.language_kz_full') },
    { code: 'en', label: t('platform.language_en'), full: t('platform.language_en_full') },
  ];

  const switchLang = (code: string) => {
    i18n.changeLanguage(code);
    document.documentElement.lang = code === 'kz' ? 'kk' : code;
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {LANGUAGES.map((lang) => (
          <button key={lang.code} onClick={() => switchLang(lang.code)}
            className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
              current === lang.code ? 'bg-dv-gold text-dv-gold-on' : 'text-gray-400 hover:text-gray-200'
            }`}>
            {lang.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-surface-1 hover:text-gray-200">
        <Globe size={14} />
        <span>{LANGUAGES.find(l => l.code === current)?.label || 'Рус'}</span>
      </button>
      {open && <div role="menu" className="absolute top-full right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl p-1.5 shadow-xl z-50 min-w-[140px]">
        {LANGUAGES.map((lang) => (
          <button key={lang.code} onClick={() => switchLang(lang.code)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              current === lang.code ? 'bg-dv-gold/20 text-dv-gold' : 'text-gray-300 hover:bg-surface-1'
            }`}>
            {lang.full}
          </button>
        ))}
      </div>}
    </div>
  );
}
