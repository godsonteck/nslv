import { describe, expect, it } from 'vitest';
import { escapeHtml, openPrintWindow } from './html';

describe('escapeHtml', () => {
  it('escapes every character that can break out of markup or an attribute', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;',
    );
  });

  it('normalises nullish values to an empty string', () => {
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(null)).toBe('');
  });
});

describe('openPrintWindow', () => {
  it('does nothing outside a browser', () => {
    expect(openPrintWindow('width=380,height=560')).toBeNull();
  });
});
