import React from 'react';
import { villaAssets } from '../../assets';

// Decorative ambient light field plus a subtle, non-competing logo watermark.
// The watermark sits at the back (z-index -1), is fully pointer-transparent,
// and uses very low opacity + soft-light blending so it never competes with
// page copy in either theme.
export const AmbientBackdrop: React.FC = () => (
  <div className="ns-ambient" aria-hidden="true">
    <div className="ns-orb ns-orb-1" />
    <div className="ns-orb ns-orb-2" />
    <div className="ns-orb ns-orb-3" />
    <img
      src={villaAssets.logo}
      alt=""
      aria-hidden="true"
      className="ns-watermark"
      loading="lazy"
      decoding="async"
    />
  </div>
);

export default AmbientBackdrop;
