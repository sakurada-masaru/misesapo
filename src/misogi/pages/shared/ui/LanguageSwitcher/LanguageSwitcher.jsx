import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="lang-switcher" title={t('言語')}>
      <span>{t('言語')}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value)}>
        <option value="ja">日本語</option>
        <option value="pt-BR">Português (BR)</option>
      </select>
    </label>
  );
}
