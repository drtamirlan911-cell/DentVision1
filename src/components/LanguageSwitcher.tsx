import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'ru', label: 'Рус', full: 'Русский' },
  { code: 'kz', label: 'Қаз', full: 'Қазақша' },
  { code: 'en', label: 'Eng', full: 'English' },
];

export default function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('kz') ? 'kz' : i18n.language?.startsWith('en') ? 'en' : 'ru';

  const switchLang = (code: string) => {
    i18n.changeLanguage(code);
    document.documentElement.lang = code === 'kz' ? 'kk' : code;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {LANGUAGES.map((lang) => (
          <button key={lang.code} onClick={() => switchLang(lang.code)}
            className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
              current === lang.code ? 'bg-dv-gold text-white' : 'text-gray-400 hover:text-gray-200'
            }`}>
            {lang.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative group">
      <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
        <Globe size={14} />
        <span>{LANGUAGES.find(l => l.code === current)?.label || 'Рус'}</span>
      </button>
      <div className="absolute top-full right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl p-1.5 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[140px]">
        {LANGUAGES.map((lang) => (
          <button key={lang.code} onClick={() => switchLang(lang.code)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              current === lang.code ? 'bg-dv-gold/20 text-dv-gold' : 'text-gray-300 hover:bg-white/5'
            }`}>
            {lang.full}
          </button>
        ))}
      </div>
    </div>
  );
}
