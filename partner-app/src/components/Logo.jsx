import React from 'react';
import logoSrc from '../assets/hospin-logo.png';

/**
 * Renders the exact Hospin logo file provided — pixel-for-pixel, no
 * recreation, no recoloring. `variant="mark"` crops to just the icon mark
 * for tight spaces (nav bars, headers) using object-position; `variant="full"`
 * shows the full lockup (mark + wordmark + tagline) for splash/login screens.
 */
export default function Logo({ variant = 'full', className = '' }) {
  if (variant === 'mark') {
    return (
      <div className={`overflow-hidden ${className}`} style={{ aspectRatio: '1 / 1' }}>
        <img
          src={logoSrc}
          alt="Hospin"
          className="w-full h-full object-cover"
          style={{ objectPosition: '50% 30%', transform: 'scale(2.6)' }}
        />
      </div>
    );
  }

  return (
    <img
      src={logoSrc}
      alt="Hospin — Care Beyond Today"
      className={className}
    />
  );
}
