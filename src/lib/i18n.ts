import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ru from '../locales/ru.json';
import kz from '../locales/kz.json';
import en from '../locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ru: { translation: ru }, kz: { translation: kz }, en: { translation: en } },
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
    // Only the explicit switcher decides the language. `navigator` used to be a
    // fallback, which meant a clinic in Almaty running an English-locale Windows
    // got an English UI on first load — the product ships ru/kz/en but its users
    // are Kazakhstani, so the browser locale is a bad proxy for what they want.
    // No stored choice yet -> fallbackLng ('ru').
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'dv_lang',
    },
  });

export default i18n;
