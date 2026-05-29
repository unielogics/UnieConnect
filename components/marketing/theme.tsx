import React, { createContext, useContext } from 'react';

export type SiteTheme = 'dark' | 'light';

export const SiteThemeContext = createContext<SiteTheme>('dark');

/** Read the current marketing-site theme (dark | light) from context. */
export const useSiteTheme = (): SiteTheme => useContext(SiteThemeContext);
