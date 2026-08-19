# PERMANENT PROJECT OPERATING RULES & DIRECTIVES

## 1. PROJECT IDENTITY & SCOPE
- **Application**: Fathi Aqua Super ERP — Multi-Platform Sturgeon Aquaculture & Caviar Enterprise Super ERP (v6.0).
- **Supported Locales**: 7 locales with 100% key parity and dynamic RTL/LTR switching (`fa`, `en`, `de`, `ru`, `ar`, `fr`, `es`).
- **Core Principles**:
  - Offline-first LAN operation capability.
  - Strict biological safety: Prohibit feeding when dissolved oxygen (DO) < 4.0 mg/L or status is STOPPED.
  - Atomic fish transfers with zero biomass loss.
  - Double-entry accounting with auto-balancing debit/credit validation.
  - Runtime AI dynamic translation for user-generated content without mutating original database records.
  - No plaintext secrets or passwords (crypto SHA-256 + salt only).

## 2. AUTOMATIC QA + GITHUB SYNC PIPELINE
After EVERY task, change, fix, or refactor, execute the full cycle automatically:
1. **Implement**: Surgical code changes respecting user intent and domain rules.
2. **Verify & Lint**: Run `npm run lint` / `tsc --noEmit`.
3. **Test Suite**: Run `npx vitest run` ensuring 100% test passing across all test suites.
4. **Compile**: Run production build check `compile_applet`.
5. **Security & Secret Audit**: Scan modified files to guarantee no secrets/API keys/credentials are committed.
6. **Git Status & Commit**: Inspect diffs and create clean, conventional commit messages.
7. **GitHub Sync & Remote Verification**: Sync with target repository `morefa1986-jpg/ERp-AiStudio-1` on branch `main`.
8. **Structured Reporting**: Output standardized report with task summary, test metrics, build status, git branch, commit SHA, and remote sync state.
