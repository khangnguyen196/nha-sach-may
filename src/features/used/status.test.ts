import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LISTING_STATUSES, nextListingStatuses } from './status'

const schemaSql = readFileSync(join(import.meta.dirname, '../../../supabase/schema.sql'), 'utf8')

/** Bảng chuyển trạng thái trong `private.used_listing_transition_allowed` của schema.sql (nguồn sự thật ở DB) */
function transitionsInSchema() {
  const body = /function private\.used_listing_transition_allowed[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(schemaSql)?.[1]
  if (!body) throw new Error('Không tìm thấy used_listing_transition_allowed trong schema.sql')
  const table = new Map<string, string[]>()
  for (const [, from, targets] of body.matchAll(/when '(\w+)'\s+then p_to in \(([^)]*)\)/g)) {
    table.set(from ?? '', [...(targets ?? '').matchAll(/'(\w+)'/g)].map((match) => match[1] ?? ''))
  }
  return table
}

describe('LISTING_STATUSES', () => {
  it('trùng enum public.used_listing_status trong schema.sql (cả thứ tự)', () => {
    const values = /create type public\.used_listing_status\s+as enum \(([^)]*)\)/.exec(schemaSql)?.[1]
    if (!values) throw new Error('Không tìm thấy enum used_listing_status trong schema.sql')
    expect([...values.matchAll(/'(\w+)'/g)].map((match) => match[1])).toEqual([...LISTING_STATUSES])
  })
})

describe('nextListingStatuses', () => {
  it('trùng bảng chuyển trạng thái của trigger trong schema.sql', () => {
    const schema = transitionsInSchema()
    expect(schema.size).toBeGreaterThan(0)
    for (const from of schema.keys()) expect(LISTING_STATUSES, from).toContain(from)
    for (const status of LISTING_STATUSES) {
      expect([...nextListingStatuses(status)].sort(), status).toEqual([...(schema.get(status) ?? [])].sort())
    }
  })

  it('withdrawn là trạng thái cuối; sold chỉ quay về approved (đơn bị hủy)', () => {
    expect(nextListingStatuses('withdrawn')).toEqual([])
    expect(nextListingStatuses('sold')).toEqual(['approved'])
  })

  it('sửa tin đã duyệt / bị từ chối → về chờ duyệt; admin gỡ được tin đã duyệt', () => {
    expect(nextListingStatuses('approved')).toContain('pending')
    expect(nextListingStatuses('rejected')).toContain('pending')
    expect(nextListingStatuses('approved')).toContain('rejected')
  })
})
