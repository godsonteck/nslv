import React from 'react';
import { villaAssets } from '../../assets';

// Full-page tiled logo watermark behind the ambient light field. Repeats
// across the whole viewport at low opacity so it reads as a subtle brand
// watermark rather than competing with page copy. Fully pointer-transparent.
export const AmbientBackdrop: React.FC = () => (
  <div
    className="ns-ambient"
    aria-hidden="true"
    style={{
      backgroundImage: `url(${villaAssets.logo})`,
      backgroundRepeat: 'repeat',
      backgroundSize: '220px 220px',
      backgroundPosition: '0 0',
    }}
  >
    <div className="ns-orb ns-orb-1" />
    <div className="ns-orb ns-orb-2" />
    <div className="ns-orb ns-orb-3" />
  </div>
);

export default AmbientBackdrop;
