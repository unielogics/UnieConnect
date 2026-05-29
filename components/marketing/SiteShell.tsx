import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { MarketingNav } from './MarketingNav';
import { Footer } from './Footer';
import { SiteThemeContext, SiteTheme } from './theme';

const THEME_KEY = 'uc-site-theme';

type Props = {
  children: React.ReactNode;
  variant?: 'full' | 'audit';
  footer?: boolean;
};

/**
 * Shared shell for the public marketing site (Landing + Audit).
 * Owns theme (dark|light, persisted) and the burger-menu open state, applies
 * them to the scoped `.uc-site` wrapper, and exposes the theme via context so
 * descendants (e.g. the Leaflet audit map) can react to it.
 */
export const SiteShell = ({ children, variant = 'full', footer = true }: Props) => {
  const [theme, setTheme] = useState<SiteTheme>('dark');
  const [menuOpen, setMenuOpen] = useState(false);

  // Restore persisted theme after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch { /* ignore */ }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Lock body scroll while the menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [menuOpen]);

  return (
    <SiteThemeContext.Provider value={theme}>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className={`uc-site${menuOpen ? ' menu-open' : ''}`} data-theme={theme}>
        <MarketingNav
          variant={variant}
          theme={theme}
          onToggleTheme={toggleTheme}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((o) => !o)}
          onCloseMenu={() => setMenuOpen(false)}
        />
        {children}
        {footer && <Footer />}
      </div>
    </SiteThemeContext.Provider>
  );
};
