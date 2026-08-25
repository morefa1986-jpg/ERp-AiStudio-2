import { describe, expect, it } from 'vitest';
import { FEED_RAW_MATERIAL_CATEGORY, isFeedFactoryIngredientItem } from '../utils/feedFactoryEngine';

const item = (category: string, unit = 'kg') => ({ category, unit } as any);

describe('feed factory ingredient allow-list', () => {
  it('allows only final feed and feed raw material mass items', () => {
    expect(isFeedFactoryIngredientItem(item('Feed (خوراک)', 'kg'))).toBe(true);
    expect(isFeedFactoryIngredientItem(item(FEED_RAW_MATERIAL_CATEGORY, 'gram'))).toBe(true);
    expect(isFeedFactoryIngredientItem(item('Medicine (دارو)', 'kg'))).toBe(false);
    expect(isFeedFactoryIngredientItem(item('Chemical (مواد شیمیایی)', 'kg'))).toBe(false);
    expect(isFeedFactoryIngredientItem(item(FEED_RAW_MATERIAL_CATEGORY, 'piece'))).toBe(false);
  });
});
