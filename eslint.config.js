import typescriptEslint from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '*.d.ts',
      'vite.config.ts'
    ]
  },
  // TypeScript 文件配置
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      prettier
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',

      // TypeScript 特定规则
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',

      // 通用规则
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'off', // 使用 TypeScript 版本
      'prefer-const': 'error',
      'no-var': 'error'
    }
  },
  // Vue 文件配置
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: typescriptParser,
        ecmaVersion: 2020,
        sourceType: 'module'
      }
    },
    plugins: {
      vue,
      '@typescript-eslint': typescriptEslint,
      prettier
    },
    rules: {
      ...vue.configs.essential.rules,
      ...vue.configs['strongly-recommended'].rules,
      ...vue.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',

      // Vue 特定规则
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'warn',
      'vue/require-default-prop': 'off',
      'vue/require-explicit-emits': 'error',

      // TypeScript in Vue
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  // 主进程文件特殊配置
  {
    files: ['src/main/**/*.ts'],
    languageOptions: {
      globals: {
        __dirname: true,
        __filename: true,
        Buffer: true,
        process: true,
        global: true
      }
    },
    rules: {
      'no-console': 'off' // 主进程允许使用 console
    }
  }
]