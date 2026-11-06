import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', 'pruefung/**', 'werkzeuge/rundgang/aus/**'] },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['api/**/*.js', 'e2e/**/*.js', 'werkzeuge/**/*.mjs', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['web/**/*.{js,vue}'],
    languageOptions: { globals: globals.browser },
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  {
    files: ['e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  prettier,
];
