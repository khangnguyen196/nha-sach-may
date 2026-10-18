import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SupportEmailText } from '@/components/layout/support-email-text'
import { SUPPORT_EMAIL } from './support'

const root = join(import.meta.dirname, '..', '..')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

describe('SUPPORT_EMAIL', () => {
  it('là một địa chỉ email', () => {
    expect(SUPPORT_EMAIL).toMatch(/^[a-z0-9.-]+@[a-z0-9.-]+\.[a-z]+$/)
  })

  it('chỉ khai báo ở lib/support.ts: src/ và messages/ không chép địa chỉ (câu dùng tham số {email})', () => {
    const copies = [...files(join(root, 'src')), ...files(join(root, 'messages'))]
      .filter((path) => !path.endsWith('support.ts') && !path.endsWith('.test.ts'))
      .filter((path) => readFileSync(path, 'utf8').includes(SUPPORT_EMAIL))
      .map((path) => relative(root, path))
    expect(copies).toEqual([])
  })
})

describe('SupportEmailText', () => {
  const render = (text: string) => renderToStaticMarkup(createElement(SupportEmailText, { text }))

  it('email trong câu → link mailto, phần chữ còn lại giữ nguyên', () => {
    const html = render(`Bạn gửi email tới ${SUPPORT_EMAIL} kèm mã đơn nhé.`)
    expect(html).toContain(`Bạn gửi email tới <a href="mailto:${SUPPORT_EMAIL}"`)
    expect(html).toContain(`>${SUPPORT_EMAIL}</a> kèm mã đơn nhé.`)
  })

  it('không có email → chỉ là chữ', () => {
    expect(render('Không có mã giảm giá này.')).toBe('Không có mã giảm giá này.')
  })
})
