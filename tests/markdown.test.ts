import { describe, expect, it } from 'vitest';
import { markdownToTiptapHtml } from '../src/skool/markdown.js';

describe('markdownToTiptapHtml', () => {
  it('converts headings to h-tags by level', () => {
    expect(markdownToTiptapHtml('# One')).toBe('<h1>One</h1>');
    expect(markdownToTiptapHtml('## Two')).toBe('<h2>Two</h2>');
    expect(markdownToTiptapHtml('### Three')).toBe('<h3>Three</h3>');
  });

  it('groups consecutive bullet lines into one list', () => {
    const html = markdownToTiptapHtml('- alpha\n- beta');
    expect(html).toBe('<ul><li><p>alpha</p></li><li><p>beta</p></li></ul>');
  });

  it('groups numbered lines into an ordered list', () => {
    const html = markdownToTiptapHtml('1. first\n2. second');
    expect(html).toBe('<ol><li><p>first</p></li><li><p>second</p></li></ol>');
  });

  it('splits separate lists when the kind changes', () => {
    const html = markdownToTiptapHtml('- a\n1. b');
    expect(html).toBe('<ul><li><p>a</p></li></ul><ol><li><p>b</p></li></ol>');
  });

  it('renders plain lines as paragraphs and preserves inline code', () => {
    const html = markdownToTiptapHtml('Run `npx remotion render` now.');
    expect(html).toBe('<p>Run <code>npx remotion render</code> now.</p>');
  });

  it('escapes HTML-significant characters outside code', () => {
    const html = markdownToTiptapHtml('use a & b < c > d');
    expect(html).toBe('<p>use a &amp; b &lt; c &gt; d</p>');
  });

  it('flushes a list before a following heading or paragraph', () => {
    const html = markdownToTiptapHtml('- a\n\n## Next');
    expect(html).toBe('<ul><li><p>a</p></li></ul><h2>Next</h2>');
  });

  it('handles a full lesson body shape', () => {
    const md = [
      'Intro paragraph.',
      '',
      '## What you will learn',
      '- one',
      '- two',
      '',
      '## Steps',
      '1. do this',
      '2. do that',
    ].join('\n');
    const html = markdownToTiptapHtml(md);
    expect(html).toBe(
      '<p>Intro paragraph.</p>' +
        '<h2>What you will learn</h2>' +
        '<ul><li><p>one</p></li><li><p>two</p></li></ul>' +
        '<h2>Steps</h2>' +
        '<ol><li><p>do this</p></li><li><p>do that</p></li></ol>',
    );
  });
});
