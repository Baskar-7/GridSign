import { describe, it, expect } from 'vitest';
import { appendSigningToken, extractSigningParams } from '@/lib/signingToken';

describe('Signing Token Utilities', () => {
  it('extractSigningParams returns token and recipientId', () => {
    const { token, recipientId } = extractSigningParams('?recipientId=42&token=abc123');
    expect(token).toBe('abc123');
    expect(recipientId).toBe(42);
  });

  it('appendSigningToken appends Token field', () => {
    const fd = new FormData();
    appendSigningToken(fd, 'tok123');
    expect(fd.get('Token')).toBe('tok123');
  });

  it('appendSigningToken throws when token missing', () => {
    const fd = new FormData();
    expect(() => appendSigningToken(fd)).toThrow(/Missing signing token/);
  });
});
