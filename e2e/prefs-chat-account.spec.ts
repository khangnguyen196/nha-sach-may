import { expect, test, type Browser, type Locator } from '@playwright/test'
import { bookBlockTargets, createE2eUser, deleteE2eUsers, replaceUserBlocks, type E2eUser } from '../scripts/e2e-user'
import { login, NO_SESSION } from './auth'
import { ask, openChat } from './chat'
import { collectErrors } from './helpers'

// Mây không gợi ý sách bị chặn theo sở thích của người hỏi (docs/plans/so-thich-canh-bao.md, câu 10). AI giả
// (CHAT_AI_MOCK): trả slug đầu của danh sách ứng viên mà server gửi ([mock:5-books]: 4 slug + 1 slug lạ → 3 thẻ), nên
// sách lọt vào ứng viên là lên thẻ. User riêng mỗi test, mục chặn chèn bằng service role, xóa user ở finally
// (user_blocks xóa theo cascade). Chỉ chặn tác giả / danh mục của sách mẫu, không sửa sách. Giả định dữ liệu:
// scripts/e2e-seed.test.ts (prefs-chat-account).
test.use({ storageState: NO_SESSION })

const QUESTION = '[mock:5-books] Gợi ý vài cuốn sách hay cho mình'
/** Sách mẫu có tác giả, còn hàng: (c) chặn tác giả của nó rồi hỏi Mây ngay ở trang sách */
const VIEWED = 'sapiens'

type BlockTargets = Awaited<ReturnType<typeof bookBlockTargets>>

/** Slug của các thẻ sách trong một câu trả lời (link `/sach/<slug>`) */
async function cardSlugs(reply: Locator) {
  const hrefs = await reply.getByTestId('chat-book-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('href')))
  return hrefs.map((href) => {
    const slug = /^\/sach\/([a-z0-9-]+)$/.exec(href ?? '')?.[1]
    if (!slug) throw new Error(`Thẻ sách có href lạ: ${href}`)
    return slug
  })
}

/** Đăng nhập user trong context riêng, mở Mây ở `path`, hỏi một câu; trả slug các thẻ + câu trả lời */
async function askAs(browser: Browser, baseURL: string | undefined, user: E2eUser, path: string, question: string) {
  const context = await browser.newContext({ baseURL, storageState: NO_SESSION })
  try {
    const page = await context.newPage()
    const errors = collectErrors(page)
    await login(page, user)
    await page.goto(path)
    const panel = await openChat(page)
    const reply = await ask(panel, question)
    await expect(reply).toHaveAttribute('data-testid', 'chat-reply')
    const slugs = await cardSlugs(reply)
    const replyText = (await reply.textContent()) ?? ''
    const subtitle = (await panel.locator('#chat-subtitle').textContent()) ?? ''
    expect(errors).toEqual([])
    return { slugs, replyText, subtitle }
  } finally {
    await context.close()
  }
}

test('(a)(b) thành viên B (không chặn) có thẻ thuộc tập sắp chặn; A chặn danh mục / tác giả của tập đó → cùng câu, không thẻ nào thuộc tập', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(90_000)
  const [userB, userA] = await Promise.all([
    createE2eUser(`${testInfo.project.name}-prefs-chat-b`),
    createE2eUser(`${testInfo.project.name}-prefs-chat-a`),
  ])
  try {
    // (a) Đối chứng: B không chặn gì → 3 thẻ; tập sắp chặn lấy từ chính các thẻ sách mẫu này (test không rỗng nghĩa).
    // Bỏ sách e2e-… (spec khác chạy song song có thể tạo sách không danh mục / không tác giả, vẫn lên catalog của Mây)
    const control = await askAs(browser, baseURL, userB, '/', QUESTION)
    expect(control.slugs).toHaveLength(3)
    const sample = control.slugs.filter((slug) => !slug.startsWith('e2e-'))
    expect(sample.length).toBeGreaterThan(0)
    const targets = await Promise.all(sample.map((slug) => bookBlockTargets(slug)))
    const [first, ...rest] = targets
    if (!first || first.categoryId === null) throw new Error(`${sample[0]}: không có danh mục`)
    const categoryId = first.categoryId
    const authorIds = [...new Set(rest.flatMap((target) => target.authorIds))]
    if (rest.some((target) => target.authorIds.length === 0)) throw new Error('Thẻ đối chứng không có tác giả vai trò author')
    const inBlockedSet = (target: BlockTargets) =>
      target.categoryId === categoryId || target.authorIds.some((id) => authorIds.includes(id))
    expect(targets.every(inBlockedSet)).toBe(true)

    // (b) A chặn danh mục của thẻ đầu + tác giả của các thẻ còn lại → cùng câu: vẫn có thẻ, không thẻ nào thuộc tập
    await replaceUserBlocks(userA.id, [
      { kind: 'category', category_id: categoryId },
      ...authorIds.map((id) => ({ kind: 'author' as const, author_id: id })),
    ])
    const blocked = await askAs(browser, baseURL, userA, '/', QUESTION)
    expect(blocked.slugs.length).toBeGreaterThan(0)
    for (const slug of sample) expect(blocked.slugs).not.toContain(slug)
    const shown = await Promise.all(blocked.slugs.map((slug) => bookBlockTargets(slug)))
    for (const [index, target] of shown.entries()) expect(inBlockedSet(target), blocked.slugs[index]).toBe(false)
  } finally {
    await deleteE2eUsers([userA.id, userB.id])
  }
})

test('(c) trang của cuốn bị chặn: Mây vẫn trả lời về cuốn đó (Đang hỏi về: tên sách), không có thẻ của chính nó', async ({
  browser,
  baseURL,
}, testInfo) => {
  const viewed = await bookBlockTargets(VIEWED)
  const [authorId] = viewed.authorIds
  if (authorId === undefined) throw new Error(`${VIEWED}: không có tác giả vai trò author`)
  const user = await createE2eUser(`${testInfo.project.name}-prefs-chat-c`)
  try {
    await replaceUserBlocks(user.id, [{ kind: 'author', author_id: authorId }])
    const result = await askAs(browser, baseURL, user, `/sach/${VIEWED}`, 'Cuốn này nói về gì?')
    expect(result.subtitle).toBe(`Đang hỏi về: ${viewed.title}`)
    expect(result.replyText).toContain(viewed.title)
    // AI giả trả 3 slug đầu của ứng viên: chưa lọc thì cuốn đang xem đứng đầu danh sách → thẻ đầu
    expect(result.slugs.length).toBeGreaterThan(0)
    expect(result.slugs).not.toContain(VIEWED)
    const shown = await Promise.all(result.slugs.map((slug) => bookBlockTargets(slug)))
    for (const [index, target] of shown.entries()) expect(target.authorIds, result.slugs[index]).not.toContain(authorId)
  } finally {
    await deleteE2eUsers([user.id])
  }
})
