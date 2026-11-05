import { describe, expect, it } from 'vitest';
import { formspreeAction } from './formspree';

describe('formspreeAction', () => {
  it('builds the Formspree URL from the form ID', () => {
    expect(formspreeAction('xyzabcde')).toBe('https://formspree.io/f/xyzabcde');
  });

  it('ignores spaces around the ID (easy to paste by accident)', () => {
    expect(formspreeAction('  xyzabcde \n')).toBe('https://formspree.io/f/xyzabcde');
  });

  it('returns null when the ID is missing, empty or not an ID', () => {
    expect(formspreeAction(undefined)).toBeNull();
    expect(formspreeAction('')).toBeNull();
    expect(formspreeAction('   ')).toBeNull();
    expect(formspreeAction('https://formspree.io/f/xyzabcde')).toBeNull();
  });
});
