import React from 'react';
import { villaAssets } from '../../assets';
import { useThemeStore } from '../../stores/themeStore';

/**
 * Fixed, non-interactive backdrop that gives the glass surfaces something to
 * refract: layered brand-colour light, slow drifting orbs, and the villa logo
 * as a centred watermark. Rendered once at the app root so every route —
 * workstation, login and error pages — shares the same canvas.
 */
export const AmbientBackdrop: React.FC = () => {
  const logoUrl = useThemeStore((s) => s.theme?.logoUrl);
  const logo = logoUrl || villaAssets.logo;

  return (
    <div className="ns-ambient" aria-hidden="true">
      <span className="ns-orb ns-orb-1" />
      <span className="ns-orb ns-orb-2" />
      <span className="ns-orb ns-orb-3" />
      <div className="ns-watermark">
        <img src={logo} alt="" />
      </div>
    </div>
  );
};

export default AmbientBackdrop;
