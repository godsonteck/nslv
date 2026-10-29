import React from 'react';
import { villaAssets } from '../../assets';
import { useThemeStore } from '../../stores/themeStore';

export const AmbientBackdrop: React.FC = () => {
  const logoUrl = useThemeStore((s) => s.theme?.logoUrl);
  const logo = logoUrl || villaAssets.logo;

  return (
    <div className="ns-ambient" aria-hidden="true">
      <div className="ns-watermark">
        <img src={logo} alt="" />
      </div>
    </div>
  );
};

export default AmbientBackdrop;
