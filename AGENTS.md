# PERMANENT PROJECT OPERATING RULES & DIRECTIVES

## 1. PROJECT IDENTITY & SCOPE
- **Application**: Fathi Aqua Super ERP — Multi-Platform Sturgeon Aquaculture & Caviar Enterprise Super ERP (v6.1).
- **Target Repository**: `morefa1986-jpg/ERp-AiStudio-2` (branch `main`).
- **Supported Locales**: 7 locales with 100% key parity and dynamic RTL/LTR switching (`fa`, `en`, `de`, `ru`, `ar`, `fr`, `es`).
- **Core Principles**:
  - Offline-first LAN operation capability.
  - Strict biological safety: Prohibit feeding when dissolved oxygen (DO) < 4.0 mg/L or status is STOPPED.
  - Atomic fish transfers with zero biomass loss.
  - Double-entry accounting with auto-balancing debit/credit validation.
  - Runtime AI dynamic translation for user-generated content without mutating original database records.
  - No plaintext secrets or passwords. Production authentication is server-owned SQLite with salted scrypt hashes; the legacy browser compatibility helper is not an authentication store.
  - Optional AI: Core ERP must never fail when GEMINI_API_KEY is missing or offline.

## 2. AUTOMATIC QA + GITHUB SYNC PIPELINE
After EVERY task, execute the full cycle automatically:
1. **Implement**: Surgical code changes respecting user intent and domain rules.
2. **Verify & Lint**: Run `npx tsc --noEmit` / `npm run lint`.
3. **Test Suite**: Run `npx vitest run` ensuring 100% test passing across all test suites.
4. **Compile**: Run production build check `compile_applet`.
5. **Security & Secret Audit**: Scan modified files to guarantee no secrets/API keys/credentials are committed.
6. **Git Status & Commit**: Inspect diffs and create clean, conventional commit messages.
7. **GitHub Push & Verification**: Push the repair branch to `morefa1986-jpg/ERp-AiStudio-2`, create/update a draft PR, and read the CI result before any merge.
8. **Standardized Handoff Report**: Always output the structured `AI_STUDIO_HANDOFF` block.
