<<<<<<< HEAD
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
=======
# School & Work

Life OSと連携する学校・バイト管理アプリです。

## 概要

School & Work は Life OS のサブアプリです。

学校の時間割・課題・テスト管理と、
アルバイトのシフト・給料管理を行います。

登録したデータは Firebase を通して
Life OS と自動同期されます。

## 主な機能

- 時間割管理
- 課題管理
- テスト管理
- シフト管理
- 給料自動計算
- Firebase同期

## 使用技術

- React
- TypeScript
- Vite
- Firebase
- Firestore
- Tailwind CSS

## 今後追加予定

- 通知機能
- 給与履歴
- 月間統計
- Life OSとの連携強化
>>>>>>> 12be8a8bd5d16f0b24d03a73cd18ea20e7228e83
