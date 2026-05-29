import React, { useEffect } from 'react';
import Link from 'next/link';
import { Logo } from './Logo';
import type { SiteTheme } from './theme';

const NAV_LINKS = [
  { id: 'command', icon: '▤', label: 'Command Center' },
  { id: 'optimize', icon: '⊞', label: 'Multi-Warehouse Optimization' },
  { id: 'network', icon: '◉', label: 'Warehouse Network' },
  { id: 'integrations', icon: '{ }', label: 'Integrations' },
  { id: 'cortex', icon: '✦', label: 'Cortex AI' },
  { id: 'audit', icon: '◷', label: 'Free Catalog Audit', href: '/audit' },
  { id: 'different', icon: '≠', label: 'Why UnieConnect' },
];

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

type Props = {
  variant?: 'full' | 'audit';
  theme: SiteTheme;
  onToggleTheme: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
};

export const MarketingNav = ({ variant = 'full', theme, onToggleTheme, menuOpen, onToggleMenu, onCloseMenu }: Props) => {
  const [scrolled, setScrolled] = React.useState(variant === 'audit');

  useEffect(() => {
    if (variant === 'audit') return; // audit nav stays in the "scrolled" (solid) state
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseMenu(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCloseMenu]);

  const ThemeToggle = (
    <button
      className="theme-toggle"
      type="button"
      onClick={onToggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );

  return (
    <>
      <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
        <div className="wrap nav-inner">
          <Link className="brand" href="/#top"><Logo /> UnieConnect</Link>
          <div className="nav-cta">
            {ThemeToggle}
            {variant === 'audit' ? (
              <Link className="btn btn-ghost" href="/#top">← Back to site</Link>
            ) : (
              <>
                <a className="btn btn-primary nav-demo" href="/#demo">Book a Demo</a>
                <button
                  className="menu-btn"
                  type="button"
                  aria-label="Open menu"
                  aria-expanded={menuOpen}
                  onClick={onToggleMenu}
                >
                  <span /><span /><span />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {variant === 'full' && (
        <>
          <div className="menu-overlay" onClick={onCloseMenu} />
          <div className="menu-panel" role="dialog" aria-label="Navigation">
            {NAV_LINKS.map((l) => {
              const inner = (<><span className="mi">{l.icon}</span> {l.label} <span className="ma">→</span></>);
              return l.href ? (
                <Link key={l.id} href={l.href} className="menu-link" onClick={onCloseMenu}>{inner}</Link>
              ) : (
                <a key={l.id} href={`/#${l.id}`} className="menu-link" onClick={onCloseMenu}>{inner}</a>
              );
            })}
            <div className="menu-cta">
              <a className="btn btn-primary btn-lg" href="/#demo" onClick={onCloseMenu}>Book a Demo</a>
              <Link className="btn btn-ghost btn-lg" href="/oms" onClick={onCloseMenu}>Open the Platform →</Link>
            </div>
          </div>
        </>
      )}
    </>
  );
};
