import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { COPY, Language } from '../data/bostonData';
import {
  DEFAULT_I18N_CONFIG,
  I18nConfigData,
  SiteCopyBundle,
  UiTranslationRecord,
  buildMergedCopy,
} from './i18nService';

interface I18nContextValue {
  i18nConfig: I18nConfigData;
  copyBundle: SiteCopyBundle;
}

const I18nContext = createContext<I18nContextValue>({
  i18nConfig: DEFAULT_I18N_CONFIG,
  copyBundle: COPY,
});

export function I18nProvider({
  i18nConfig,
  overrides,
  children,
}: {
  i18nConfig: I18nConfigData;
  overrides: UiTranslationRecord[];
  children: ReactNode;
}) {
  const copyBundle = useMemo(() => buildMergedCopy(overrides), [overrides]);
  const value = useMemo(
    () => ({ i18nConfig, copyBundle }),
    [i18nConfig, copyBundle]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useSiteCopy(lang: Language) {
  const { copyBundle } = useContext(I18nContext);
  return copyBundle[lang];
}

export function useI18nConfig(): I18nConfigData {
  return useContext(I18nContext).i18nConfig;
}
