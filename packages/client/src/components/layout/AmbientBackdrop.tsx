import React from 'react';

// Decorative ambient light field, without any logo watermark. Rays sit behind
// the glass surfaces instead of competing with page copy.
export const AmbientBackdrop: React.FC = () => (
  <div className="ns-ambient" aria-hidden="true">
    <div className="ns-orb ns-orb-1" />
    <div className="ns-orb ns-orb-2" />
    <div className="ns-orb ns-orb-3" />
  </div>
);

export default AmbientBackdrop;
