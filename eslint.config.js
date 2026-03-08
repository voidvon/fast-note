import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['.DS_Store', '**/.DS_Store/**', 'node_modules', '**/node_modules/**', 'coverage', 'coverage/**', 'dist', 'dist/**', 'ios', 'ios/**', 'android', 'android/**', 'doc', 'doc/**', 'docs', 'docs/**', 'public', 'public/**', '.env.local', '**/.env.local/**', '.env.*.local', '**/.env.*.local/**', 'npm-debug.log*', '**/npm-debug.log*/**', 'yarn-debug.log*', '**/yarn-debug.log*/**', 'yarn-error.log*', '**/yarn-error.log*/**', 'pnpm-debug.log*', '**/pnpm-debug.log*/**', '.idea', '**/.idea/**', '.vscode', '**/.vscode/**', '*.suo', '**/*.suo/**', '*.ntvs*', '**/*.ntvs*/**', '*.njsproj', '**/*.njsproj/**', '*.sln', '**/*.sln/**', '*.sw?', '**/*.sw?/**'],
  formatters: true,
  unocss: true,
  vue: true,
  rules: {
    'no-console': 'off',
    'vue/no-deprecated-slot-attribute': ['off', {
      ignore: ['IonRefresher'],
    }],
  },
})
