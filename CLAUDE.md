# CLAUDE.md - Bluesky Social App

## Commands
- Build: `yarn build` (all platforms), `yarn build-ios`, `yarn build-android`, `yarn build-web`  
- Lint: `yarn lint` (code), `yarn lint-native` (Swift/Kotlin)
- Typecheck: `yarn typecheck`
- Test: `yarn test` (all), `yarn test -- -t "test name pattern"` (single test)
- Run: `yarn ios`, `yarn android`, `yarn web`

## Coding Conventions
- **Imports:** Use exact imports. Follow import order: React/RN, Expo, third-party, app imports.
- **Formatting:** Use Prettier (single quotes, no semi, trailing commas, no bracket spacing).
- **Text Components:** Always wrap text in Typography components - never use raw text.
- **Styling:** Use `alf` design system for components and theming.
- **Types:** Use TypeScript strictly, with proper typing for all variables and functions.
- **Error Handling:** Use structured error handling with proper types.
- **Component Structure:** Prefer functional components with hooks.
- **Naming:** PascalCase for components, camelCase for variables/functions.
- **Internationalization:** Use Lingui for i18n with `t` macro.

## Repo Organization
The codebase follows a modular structure with core functionality in `src/` directory. Main areas: components, lib, screens, state, view.

## Goal:
The goal is to convert this fork of the Bluesky social app (which has some existing code supporting integration with the Verus blockchain for posts) to use 