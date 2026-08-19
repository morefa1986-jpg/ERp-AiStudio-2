# PERMANENT PROJECT OPERATING RULES & DIRECTIVES

## 1. PROJECT IDENTITY & SCOPE
- **Application**: Fathi Aqua Super ERP — Multi-Platform Sturgeon Aquaculture & Caviar Enterprise Super ERP (v6.0).
- **Target Repository**: `morefa1986-jpg/ERp-AiStudio-1` (branch `main`).
- **Supported Locales**: 7 locales with 100% key parity and dynamic RTL/LTR switching (`fa`, `en`, `de`, `ru`, `ar`, `fr`, `es`).

## 2. AUTOMATIC QA + GITHUB SYNC PIPELINE
After EVERY user request, automatically run:
1. Lint and typecheck (`npm run lint` / `tsc --noEmit`)
2. Automated test suite (`npx vitest run`)
3. Production build check (`compile_applet`)
4. Security & Secret check (ensure no API keys, tokens, or credentials in commits)
5. Review Git status and diffs
6. Create descriptive commit and push to `morefa1986-jpg/ERp-AiStudio-1` (branch `main`)
7. Verify remote repository
8. Output standardized QA & Sync status report
