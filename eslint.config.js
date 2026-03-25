export default defineConfig({
  parser: 'vue-eslint-parser',
  parserOptions: {
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: [
    'vue'
  ],
  env: {
    es6: true,
    browser: true
  },
  settings: {
    'html/html-extensions': ['.html', '.vue']
  },
  rules: {
    // Vue-specific rules
    'vue/multi-word-component-names': 0, // Allow single-word components
    'vue/no-unused-components': ['error', {
      ignorePattern: '^_'
    }],
    
    // ESLint core rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'comma-dangle': ['error', {
      arrays: false,
      objects: false,
      imports: false,
      exports: false
    }],
    
    // TypeScript-specific rules (if tsconfig.json enables them)
    'prefer-default-export': 'off',
    'no-unused-vars': ['error', {
      args: 'all',
      argsIgnorePattern: '^err$'
    }]
  }
});