import React, { useEffect, useState } from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { villaAssets } from '../../assets';

// Knock the near-black backdrop out of the logo so only the mark ghosts through.
function toWatermark(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const width = 720;
        const height = Math.max(1, Math.round((width * img.naturalHeight) / (img.naturalWidth || width)));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          const luminance = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
          px[i + 3] = Math.max(0, Math.min(255, (luminance - 90) * 2.5));
        }
        ctx.putImageData(data, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

export const AmbientBackdrop: React.FC = () => {
  const logo = useThemeStore((s) => s.theme?.logoUrl) || villaAssets.logo;
  const [mark, setMark] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void toWatermark(logo).then((result) => {
      if (!cancelled) setMark(result);
    });
    return () => {
      cancelled = true;
    };
  }, [logo]);

  return (
    <div className="ns-ambient" aria-hidden="true">
      {mark && <img className="ns-ambient__watermark" src={mark} alt="" draggable={false} />}
    </div>
  );
};

export default AmbientBackdrop;