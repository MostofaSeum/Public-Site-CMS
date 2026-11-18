import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  claimFieldHover,
  isFieldHoverActive,
  releaseFieldHover,
  subscribeToFieldHover,
} from '../src/site/sectionContext';

describe('field hover', () => {
  const first = vi.fn();
  const second = vi.fn();

  afterEach(() => {
    releaseFieldHover(first);
    releaseFieldHover(second);
    vi.clearAllMocks();
  });

  it('keeps only one field active at a time', () => {
    claimFieldHover(first);
    claimFieldHover(second);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(isFieldHoverActive()).toBe(true);
  });

  it('does not hide a field that claims again', () => {
    claimFieldHover(first);
    claimFieldHover(first);
    expect(first).not.toHaveBeenCalled();
  });

  it('ignores a release from a field that is no longer active', () => {
    claimFieldHover(first);
    claimFieldHover(second);
    releaseFieldHover(first);
    expect(isFieldHoverActive()).toBe(true);
    releaseFieldHover(second);
    expect(isFieldHoverActive()).toBe(false);
  });

  it('tells subscribers when the active state changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToFieldHover(listener);
    claimFieldHover(first);
    releaseFieldHover(first);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    claimFieldHover(first);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
