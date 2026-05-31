import { translations, getCurrentLang, setCurrentLang, t } from './translations.js';
import { triggerHaptic } from './haptic.js';

export function updateLanguage() {
  const lang = getCurrentLang();
  const langBtn = document.querySelector('.lang-toggle');
  if (langBtn) langBtn.textContent = lang === 'en' ? 'ML' : 'EN';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) el.textContent = translations[lang][key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[lang][key]) el.placeholder = translations[lang][key];
  });

  document.querySelectorAll('option[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) el.textContent = translations[lang][key];
  });
}

export function toggleLanguage() {
  const next = getCurrentLang() === 'en' ? 'ml' : 'en';
  setCurrentLang(next);
  updateLanguage();
  triggerHaptic('light');
}
