// ============================================
// NS LUXURY VILLA — Universal Glass Morphism
// Forces EVERY surface to translucent frosted glass.
// Runs on mount and watches for dynamically added nodes.
// ============================================

const GLASS_CSS = `
  position: relative !important;
  background: var(--ns-glass-bg) !important;
  background-image: none !important;
  backdrop-filter: blur(34px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(34px) saturate(180%) !important;
  border: 1px solid var(--ns-glass-border) !important;
  box-shadow: var(--ns-glass-shadow) !important;
`;

const GLASS_INPUT_CSS = `
  background: var(--ns-glass-bg) !important;
  backdrop-filter: blur(18px) !important;
  -webkit-backdrop-filter: blur(18px) !important;
  border: 1px solid var(--ns-glass-border) !important;
`;

// Elements that should stay transparent (no fill) but keep glass border
const TRANSPARENT_TAGS = new Set(['button', 'input', 'select', 'textarea']);
const GLASS_TAGS = new Set(['div', 'section', 'main', 'aside', 'header', 'footer', 'article', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ul', 'ol', 'table', 'tbody', 'thead', 'tr', 'td', 'th', 'dl', 'dt', 'dd']);

function hasOwnBackground(el: Element): boolean {
  const style = window.getComputedStyle(el);
  const bg = style.backgroundColor;
  const bgImage = style.backgroundImage;
  const inline = el.getAttribute('style') || '';
  // Has an explicit opaque background (not transparent/inherit/initial)
  const hasBg =
    bg &&
    bg !== 'rgba(0, 0, 0, 0)' &&
    bg !== 'transparent' &&
    !bg.includes('var(--') &&
    !bg.startsWith('rgba(255, 255, 255, 0') &&
    !bg.startsWith('rgba(14, 20, 30, 0');
  const hasImage = bgImage && bgImage !== 'none' && !bgImage.includes('var(--');
  const hasInlineBg = /background(-color|-image)?:\s*(?!transparent|none|inherit|initial|var\(|rgba\(0|rgba\(14)/i.test(inline);
  return hasBg || hasImage || hasInlineBg;
}

function applyGlass(el: Element) {
  if (!el || !(el instanceof HTMLElement)) return;
  const tag = el.tagName.toLowerCase();

  // Skip images, videos, canvases, svgs, icons, and links that shouldn't be filled
  if (['img', 'video', 'canvas', 'svg', 'picture', 'source', 'track', 'map', 'area'].includes(tag)) return;
  if (el.closest('.ns-watermark, .noprint')) return;

  // Skip lucide icons and similar icon wrappers
  if (el.classList.contains('lucide-icon') || el.getAttribute('data-lucide')) return;

  // Skip form controls that are already glass-input
  if (TRANSPARENT_TAGS.has(tag) && !hasOwnBackground(el)) return;

  if (hasOwnBackground(el) || GLASS_TAGS.has(tag)) {
    el.style.cssText += `;${tag === 'input' || tag === 'select' || tag === 'textarea' ? GLASS_INPUT_CSS : GLASS_CSS}`;
    el.classList.add('ns-glass-forced');
  }
}

let observer: MutationObserver | null = null;

export function forceGlassMorphism(scope: Element | Document = document) {
  // Apply to everything in scope
  scope.querySelectorAll('*').forEach(applyGlass);
  // Also apply to scope itself if it's an element
  if (scope instanceof HTMLElement) applyGlass(scope);

  // Watch for dynamic additions
  if (observer) observer.disconnect();
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          const el = node as Element;
          applyGlass(el);
          el.querySelectorAll('*').forEach(applyGlass);
        }
      });
    }
  });
  observer.observe(scope, { childList: true, subtree: true });
}

export function stopGlassMorphism() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}
