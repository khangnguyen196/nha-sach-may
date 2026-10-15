import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// Server Action là endpoint POST gọi thẳng được (không qua layout / proxy của /admin) → mọi action admin phải tự
// kiểm tra quyền ngay câu đầu tiên. Thêm action mới mà quên thì test này fail.

const ADMIN_DIR = import.meta.dirname

function actionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name === 'actions.ts')
    .map((entry) => join(entry.parentPath, entry.name))
}

/** `const denied = await assertAdmin()` */
function isAssertAdmin(statement: ts.Statement | undefined) {
  if (!statement || !ts.isVariableStatement(statement)) return false
  const [declaration] = statement.declarationList.declarations
  const init = declaration?.initializer
  return (
    init !== undefined &&
    ts.isAwaitExpression(init) &&
    ts.isCallExpression(init.expression) &&
    ts.isIdentifier(init.expression.expression) &&
    init.expression.expression.text === 'assertAdmin'
  )
}

/** `if (denied) return denied` */
function isEarlyReturn(statement: ts.Statement | undefined) {
  return (
    statement !== undefined &&
    ts.isIfStatement(statement) &&
    ts.isIdentifier(statement.expression) &&
    statement.expression.text === 'denied' &&
    ts.isReturnStatement(statement.thenStatement) &&
    statement.thenStatement.expression !== undefined &&
    ts.isIdentifier(statement.thenStatement.expression) &&
    statement.thenStatement.expression.text === 'denied'
  )
}

/** Tên các export không kiểm tra quyền đúng mẫu */
function uncheckedExports(path: string) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
  const problems: string[] = []
  for (const statement of source.statements) {
    const exported = ts.canHaveModifiers(statement)
      ? ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      : false
    if (!exported) continue
    // 'use server' chỉ được export async function; mọi dạng khác (const arrow, re-export) đều coi là lỗi để không lọt
    if (!ts.isFunctionDeclaration(statement) || !statement.body) {
      problems.push(statement.getText(source).split('\n')[0] ?? '')
      continue
    }
    const [first, second] = statement.body.statements
    if (!isAssertAdmin(first) || !isEarlyReturn(second)) problems.push(statement.name?.text ?? '(anonymous)')
  }
  const reExports = source.statements.filter((s) => ts.isExportDeclaration(s))
  for (const reExport of reExports) problems.push(reExport.getText(source))
  return problems
}

describe('Server Action admin', () => {
  const files = actionFiles(ADMIN_DIR)

  it('có file actions.ts để kiểm tra', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files.map((file) => [relative(ADMIN_DIR, file), file]))(
    '%s: mọi export gọi assertAdmin() và return sớm ở hai câu đầu',
    (_name, file) => {
      expect(uncheckedExports(file)).toEqual([])
    },
  )
})
