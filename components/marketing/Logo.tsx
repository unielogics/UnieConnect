import React from 'react';

/**
 * UnieConnect brand mark — a command-center hub: a central node wired to three
 * orbiting nodes, echoing the product's "connect everything into one hub" story.
 */
export const Logo = ({ size = 32 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="UnieConnect"
    className="brand-logo"
  >
    <defs>
      <linearGradient id="ucTile" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8b5cff" />
        <stop offset="1" stopColor="#6d3fff" />
      </linearGradient>
      <linearGradient id="ucGlow" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffffff" />
        <stop offset="1" stopColor="#d9ccff" />
      </linearGradient>
    </defs>
    <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill="url(#ucTile)" />
    <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill="none" stroke="#ffffff" strokeOpacity="0.18" />
    <g stroke="url(#ucGlow)" strokeWidth="1.6" strokeOpacity="0.5">
      <line x1="20" y1="20" x2="20" y2="9" />
      <line x1="20" y1="20" x2="10.2" y2="27" />
      <line x1="20" y1="20" x2="29.8" y2="27" />
    </g>
    <g fill="url(#ucGlow)">
      <circle cx="20" cy="9" r="3" />
      <circle cx="10.2" cy="27" r="3" />
      <circle cx="29.8" cy="27" r="3" />
    </g>
    <circle cx="20" cy="20" r="5" fill="#ffffff" />
    <circle cx="20" cy="20" r="2.2" fill="#6d3fff" />
  </svg>
);
