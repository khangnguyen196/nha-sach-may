import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Điều hướng phải đi qua i18n/navigation.ts để giữ locale và pathname đã dịch
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'next/link', message: 'Dùng Link từ @/i18n/navigation.' },
            {
              name: 'next/navigation',
              importNames: ['redirect', 'permanentRedirect', 'useRouter', 'usePathname'],
              message: 'Dùng redirect / useRouter / usePathname từ @/i18n/navigation.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='SUPABASE_SERVICE_ROLE_KEY']",
          message: 'Service role key chỉ dùng trong scripts/, không bao giờ trong src/.',
        },
        {
          selector: "CallExpression[callee.property.name='select'][arguments.0.value='*']",
          message: "Không select('*'): chỉ lấy cột cần dùng.",
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/i18n/navigation.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'src/types/database.ts', 'playwright-report/**', 'test-results/**']),
])

export default eslintConfig
