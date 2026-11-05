import { describe, it, expect } from '@jest/globals';
import {
  applyInventoryAction,
  initialInventory,
  stockFor,
} from './inventory.logic';

describe('personal inventory', () => {
  const ids = new Set([1, 2]);
  it('merges preferences without touching stock or other preferences', () => {
    const first = applyInventoryAction(
      initialInventory(),
      {
        type: 'preferences',
        revision: 0,
        preferences: {
          hiddenColors: ['red'],
          routes: [{ source: 'home-a', destination: 'home-b' }],
        },
      },
      ids,
      '',
    );
    const second = applyInventoryAction(
      first,
      {
        type: 'preferences',
        revision: 1,
        preferences: { customColors: ['Petrol'] },
      },
      ids,
      '',
    );
    expect(second.preferences).toEqual({
      hiddenColors: ['red'],
      customColors: ['Petrol'],
      routes: [{ source: 'home-a', destination: 'home-b' }],
    });
    expect(second.stock).toEqual(first.stock);
    expect(first.preferences?.customColors).toEqual([]);
  });
  it('rejects invalid routes and excessive color lists without mutation', () => {
    const data = initialInventory();
    for (const preferences of [
      { routes: [{ source: 'home-a', destination: 'home-a' }] },
      { routes: [{ source: 'home-a', destination: 'missing' }] },
      { hiddenColors: Array(101).fill('red') },
      { customColors: [''] },
    ]) {
      expect(() =>
        applyInventoryAction(
          data,
          { type: 'preferences', revision: 0, preferences },
          ids,
          '',
        ),
      ).toThrow();
      expect(data).toEqual(initialInventory());
    }
  });
  it('gives existing articles one unassigned copy', () => {
    expect(stockFor(initialInventory(), 1)).toEqual([
      { location: 'unassigned', status: 'available', quantity: 1 },
    ]);
  });
  it('splits quantities between laundry and luggage without changing totals', () => {
    let data = applyInventoryAction(
      initialInventory(),
      {
        revision: 0,
        type: 'stock',
        garmentId: 1,
        bins: [{ location: 'home-a', status: 'available', quantity: 4 }],
      },
      ids,
      'new',
    );
    data = applyInventoryAction(
      data,
      {
        revision: 1,
        type: 'transfer',
        entries: [
          {
            garmentId: 1,
            location: 'home-a',
            status: 'available',
            quantity: 2,
          },
        ],
        status: 'laundry',
      },
      ids,
      'new',
    );
    data = applyInventoryAction(
      data,
      {
        revision: 2,
        type: 'transfer',
        entries: [
          {
            garmentId: 1,
            location: 'home-a',
            status: 'available',
            quantity: 1,
          },
        ],
        destination: 'luggage',
      },
      ids,
      'new',
    );
    expect(stockFor(data, 1)).toEqual([
      { location: 'home-a', status: 'available', quantity: 1 },
      { location: 'home-a', status: 'laundry', quantity: 2 },
      { location: 'luggage', status: 'available', quantity: 1 },
    ]);
  });
  it('rejects a whole batch if a later quantity exceeds stock', () => {
    const data = initialInventory();
    const before = structuredClone(data);
    expect(() =>
      applyInventoryAction(
        data,
        {
          revision: 0,
          type: 'transfer',
          status: 'laundry',
          entries: [
            {
              garmentId: 1,
              location: 'unassigned',
              status: 'available',
              quantity: 1,
            },
            {
              garmentId: 2,
              location: 'unassigned',
              status: 'available',
              quantity: 2,
            },
          ],
        },
        ids,
        'new',
      ),
    ).toThrow();
    expect(data).toEqual(before);
  });
  it('rejects fractional quantities and articles owned by somebody else', () => {
    expect(() =>
      applyInventoryAction(
        initialInventory(),
        {
          revision: 0,
          type: 'stock',
          garmentId: 1,
          bins: [{ location: 'home-a', status: 'available', quantity: 0.5 }],
        },
        ids,
        'new',
      ),
    ).toThrow();
    expect(() =>
      applyInventoryAction(
        initialInventory(),
        { revision: 0, type: 'stock', garmentId: 3, bins: [] },
        ids,
        'new',
      ),
    ).toThrow();
  });
  it('preserves an intentionally empty stock and merges repeated bins', () => {
    const data = applyInventoryAction(
      initialInventory(),
      { revision: 0, type: 'stock', garmentId: 1, bins: [] },
      ids,
      'new',
    );
    expect(stockFor(data, 1)).toEqual([]);
    const filled = applyInventoryAction(
      data,
      {
        revision: 1,
        type: 'stock',
        garmentId: 1,
        bins: [
          { location: 'home-a', status: 'available', quantity: 2 },
          { location: 'home-a', status: 'available', quantity: 2 },
        ],
      },
      ids,
      'new',
    );
    expect(stockFor(filled, 1)).toEqual([
      { location: 'home-a', status: 'available', quantity: 4 },
    ]);
  });
});
