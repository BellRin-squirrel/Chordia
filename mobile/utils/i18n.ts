import { ja } from './i18n/locales/ja';
import { en } from './i18n/locales/en';
import { ko } from './i18n/locales/ko';
import { es } from './i18n/locales/es';
import { fr } from './i18n/locales/fr';
import { de } from './i18n/locales/de';

export type LanguageCode = 'ja' | 'en' | 'ko' | 'es' | 'fr' | 'de';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  englishLabel: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'ja', label: '日本語', englishLabel: 'Japanese' },
  { code: 'en', label: 'English', englishLabel: 'English' },
  { code: 'ko', label: '한국어', englishLabel: 'Korean' },
  { code: 'es', label: 'Español', englishLabel: 'Spanish' },
  { code: 'fr', label: 'Français', englishLabel: 'French' },
  { code: 'de', label: 'Deutsch', englishLabel: 'German' },
];

export const LANGUAGE_SELECTION_TITLES: { code: LanguageCode; text: string }[] = [
  { code: 'ja', text: 'アプリで使用する言語を選択してください' },
  { code: 'en', text: 'Please select your language' },
  { code: 'ko', text: '앱에서 사용할 언어를 선택해 주세요' },
  { code: 'es', text: 'Seleccione el idioma de la aplicación' },
  { code: 'fr', text: 'Veuillez sélectionner la langue de l\'application' },
  { code: 'de', text: 'Bitte wählen Sie die App-Sprache' },
];

export const translations: Record<LanguageCode, Record<string, string>> = {
  ja,
  en,
  ko,
  es,
  fr,
  de,
};

export const t = (key: string, lang: LanguageCode = 'ja'): string => {
  return translations[lang]?.[key] || translations['ja']?.[key] || key;
};