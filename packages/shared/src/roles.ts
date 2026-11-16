export const ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const;
export type Role = (typeof ROLES)[number];

export const LANGUAGES = ['ar', 'en', 'he'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'ar';
export const RTL_LANGUAGES: readonly Language[] = ['ar', 'he'];
export const isRtl = (language: string): boolean => RTL_LANGUAGES.includes(language as Language);
