# 🐟 Fathi Sturgeon Farm Super ERP Enterprise (v6.0)
### سامانه جامع مدیریت هوشمند تکثیر، پرورش، فرآوری و بازرگانی ماهیان خاویاری فتحی

[![CI Pipeline](https://github.com/morefa1986-jpg/ERp-AiStudio-1/actions/workflows/ci.yml/badge.svg)](https://github.com/morefa1986-jpg/ERp-AiStudio-1/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Commercial%20Enterprise-gold.svg)]()

---

## 🌟 Overview & Capabilities

**Fathi Aqua Super ERP Enterprise** is a high-availability, mission-critical Aquaculture Resource Planning system engineered for industrial sturgeon farming (*Acipenseridae*), caviar extraction, genetic lineage tracking, and multi-currency global commerce.

### 🌐 7 Native Languages with Full Cultural Localization
- 🇮🇷 **Persian (فارسی)** — Native RTL, Jalali/Shamsi calendar, IRR/Toman formatting
- 🇬🇧 **English** — Native LTR, Gregorian calendar, USD/EUR
- 🇩🇪 **German (Deutsch)** — Native LTR, DIN/ISO formats, EUR
- 🇫🇷 **French (Français)** — Native LTR, European notation, EUR
- 🇪🇸 **Spanish (Español)** — Native LTR, Metric system
- 🇷🇺 **Russian (Русский)** — Native LTR, Cyrillic nomenclature, RUB
- 🇸🇦 **Arabic (العربية)** — Native RTL, Hijri/Gregorian, AED/SAR

---

## 🛡️ Mission-Critical Safety Engines

### 1. Biological Feeding Safety Lockout
- **Dissolved Oxygen (DO) Rule**: Feeding is strictly locked (`recommendedKg = 0` and submission disabled) whenever DO < 4.0 mg/L.
- **Metabolic Temperature Window**: Feeding is halted if water temperature < 4.0°C or > 25.0°C.
- **Medical Treatment Lockout**: Active pharmaceutical quarantine blocks standard feeding rations.
- **Sensor Telemetry Validation**: Detects disconnected sensors, null/NaN values, and stale data (> 6 hours).

### 2. Transactional Consistency & Atomic Fish Transfers
- Guaranteed atomic operations: Moving fish between ponds decrements source count and increments destination count simultaneously in a single transaction with automatic recalculation of biomass and weighted average weight.

### 3. Double-Entry General Ledger (حسابداری دوبل)
- Real-time balance verification: Total Debits must equal Total Credits ($\sum \text{Debit} = \sum \text{Credit}$).
- Complete Chart of Accounts covering biological assets, feed inventory, processing yields, and international sales.

---

## 📁 System Architecture

```text
├── .github/
│   └── workflows/
│       └── ci.yml                 # Automated CI quality gate
├── src/
│   ├── components/
│   │   ├── layout/                # Header, Sidebar, Nav, Search, Modals
│   │   └── views/                 # 17 Enterprise Domain Modules
│   ├── context/
│   │   ├── AuthContext.tsx        # Multi-role authentication & RBAC
│   │   └── FarmContext.tsx        # Single source of truth state & safety engine
│   ├── data/
│   │   └── initialData.ts         # High-fidelity domain seeds
│   ├── i18n/                      # 7 native locale dictionaries & formatting
│   ├── tests/                     # Vitest automated test suites
│   ├── types/                     # TypeScript type contracts
│   └── utils/                     # Sensor validation & number sanitizers
├── server.ts                      # Express backend & Gemini AI proxy
└── vite.config.ts                 # Vite bundler configuration
```

---

## 🚀 Getting Started & Local Deployment

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Installation
```bash
# Clone the repository
git clone https://github.com/morefa1986-jpg/ERp-AiStudio-1.git
cd ERp-AiStudio-1

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Run development server (Port 3000)
npm run dev
```

### Running Automated Tests
```bash
# Execute Vitest test suite
npm test
```

### Production Build & Launch
```bash
npm run build
npm start
```

---

## 🔒 Security & RBAC Matrix
| Role | Emergency Stop | Resume Feeding | Transfer Fish | Post Journals | Manage Users |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Super Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Veterinarian** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Feeding Tech** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Financial Manager** | ❌ | ❌ | ❌ | ✅ | ❌ |

---

## 📜 License
Copyright © 2026 Fathi Sturgeon Farm. All rights reserved. Commercial Enterprise Edition.
