import React from 'react';

export const Logo = ({ size = 32 }: { size?: number }) => (
  <img
    src="/unieconnect-logo.png"
    width={size}
    height={size}
    alt="UnieConnect"
    className="brand-logo"
    loading="eager"
    decoding="async"
  />
);
