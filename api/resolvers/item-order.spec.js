/* eslint-env jest */

import { orderByClause } from './item-order'

describe('item order clauses', () => {
  test('sorts user profile posts by direct sats only', () => {
    expect(orderByClause('sats', null, null, 'posts', undefined, 'user'))
      .toBe('ORDER BY "Item".msats DESC, "Item".id DESC')
  })

  test('keeps ranked sats ordering outside user profile posts', () => {
    expect(orderByClause('sats', null, null, 'posts', undefined, 'top'))
      .toBe('ORDER BY "Item".ranktop DESC, "Item".id DESC')
    expect(orderByClause('sats', null, null, 'comments', undefined, 'user'))
      .toBe('ORDER BY "Item".ranktop DESC, "Item".id DESC')
  })
})
