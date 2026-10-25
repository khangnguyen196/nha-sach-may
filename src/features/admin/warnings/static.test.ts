import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { WARNING_GEMINI } from '@/features/chat/config'

// Kiểm tĩnh phần admin của cảnh báo nội dung (docs/plans/so-thich-canh-bao.md → P-B).

const SRC = join(import.meta.dirname, '..', '..', '..')
const ROOTS = ['features/admin', 'app/admin']
const COLUMN = 'content_warnings_reviewed_at'
// Phương thức của PostgREST chỉ đọc / lọc theo tên cột (không ghi giá trị vào cột)
const READ_METHODS = new Set(['is', 'eq', 'neq', 'not', 'gt', 'gte', 'lt', 'lte', 'in', 'order', 'filter', 'match'])

function sourceFiles() {
  return ROOTS.flatMap((root) =>
    readdirSync(join(SRC, root), { withFileTypes: true, recursive: true })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name)),
  )
}

const relativePath = (file: string) => relative(SRC, file).replaceAll('\\', '/')

function enclosingFunction(node: ts.Node): string | undefined {
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current)) return current.name?.text
  }
  return undefined
}

/** `.update({ … })`: đối tượng là tham số của lời gọi phương thức `update` */
function isUpdateArgument(objectLiteral: ts.Node) {
  const call = objectLiteral.parent
  return (
    call !== undefined &&
    ts.isCallExpression(call) &&
    ts.isPropertyAccessExpression(call.expression) &&
    call.expression.name.text === 'update'
  )
}

function isReadFilterArgument(node: ts.Node) {
  const call = node.parent
  return (
    call !== undefined &&
    ts.isCallExpression(call) &&
    call.arguments[0] === node &&
    ts.isPropertyAccessExpression(call.expression) &&
    READ_METHODS.has(call.expression.name.text)
  )
}

type Write = { file: string; fn: string | undefined; update: boolean; text: string }

/**
 * Mọi chỗ có thể ghi cột: khóa đối tượng (giá trị update / insert, khóa của schema zod: dữ liệu form đi thẳng vào update),
 * chuỗi đúng tên cột ngoài bộ lọc đọc (VD `name="…"` của ô form, khóa tính `[...]`). Tên cột trong chuỗi select ("a, b")
 * là đọc, không tính.
 */
function columnWrites(file: string): Write[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const writes: Write[] = []
  const record = (node: ts.Node, update: boolean) =>
    writes.push({ file: relativePath(file), fn: enclosingFunction(node), update, text: node.getText(source) })
  const visit = (node: ts.Node) => {
    if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && node.name.getText(source).replace(/['"]/g, '') === COLUMN) {
      record(node, isUpdateArgument(node.parent))
    } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text === COLUMN) {
      if (!isReadFilterArgument(node) && !(node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node)) {
        record(node, false)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return writes
}

describe(`${COLUMN}: chỉ "Đánh dấu đã xét (không có cảnh báo)" ghi cột này`, () => {
  const files = sourceFiles()

  it('bộ lọc còn đúng: thấy action gợi ý và form sửa sách', () => {
    const paths = files.map(relativePath)
    expect(paths).toContain('features/admin/warnings/actions.ts')
    expect(paths).toContain('features/admin/books/schemas.ts')
    expect(paths).toContain('features/admin/books/actions.ts')
  })

  it('đúng một chỗ ghi: giá trị trong .update() của markReviewedNoWarnings', () => {
    const writes = files.flatMap(columnWrites)
    expect(writes).toEqual([
      expect.objectContaining({ file: 'features/admin/warnings/actions.ts', fn: 'markReviewedNoWarnings', update: true }),
    ])
  })
})

describe('maxDuration của trang admin gọi action gợi ý', () => {
  const pages = sourceFiles().filter(
    (file) => file.endsWith('page.tsx') && readFileSync(file, 'utf8').includes("from '@/features/admin/warnings/actions'"),
  )

  it('bộ lọc còn đúng: /admin/canh-bao và /admin/sach/[id]', () => {
    expect(pages.map(relativePath).sort()).toEqual(['app/admin/canh-bao/page.tsx', 'app/admin/sach/[id]/page.tsx'])
  })

  it.each(pages.map((file) => [relativePath(file), file]))('%s: export const maxDuration = 60 (> timeout của một lượt)', (_name, file) => {
    const match = /^export const maxDuration = (\d+)$/m.exec(readFileSync(file, 'utf8'))
    expect(match?.[1]).toBe('60')
    expect(Number(match?.[1]) * 1000).toBeGreaterThan(WARNING_GEMINI.timeoutMs)
  })
})
