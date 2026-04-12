# DCF by Kong

A professional-grade web application to perform Advanced 3-Stage Discounted Cash Flow (DCF) analysis on global stocks, featuring real-time financial data fetching and an integrated AI research analyst powered by Google Gemini.

**Live Site:** [https://dcf-kong.vercel.app](https://dcf-kong.vercel.app)

---

## 🌟 Key Features
- **Advanced 3-Stage DCF:** Realistic valuation modeling with Initial High-Growth, Linear Transition (Step-down), and Terminal Perpetuity phases.
- **Fundamental Ratios:** Real-time analysis of ROE, ROA, Debt/Equity, and Operating Margins.
- **Technical Indicators:** 12-Month Moving Average (MA12) and RSI(14) integration on historical price charts.
- **Net Debt Adjustment:** Accurate calculation of Equity Value per Share by factoring in Total Cash and Total Debt.
- **PWA Optimized:** Installable as a standalone app on iOS, Android, and Desktop for a native experience.
- **Global Stock Support:** Advanced scraping for US, HK, CN, KLSE, SGX, and LSE stocks.
- **Smart AI Search:** Search by company name; Gemini automatically resolves the correct ticker and suggests alternatives.
- **AI Research Assistant:** Automatically researches and suggests DCF parameters, with a dedicated visual research indicator.
- **Interactive Visualization:** 5-year historical price and 3-stage FCF projection charts with clear stage-by-stage breakdowns.
- **User Dashboard:** Secure OTP-based authentication via Supabase to save and manage complex analyses.
- **Professional Reports:** Export your full valuation as a clean PDF summary.

---

## 🚀 How to Resume This Session
To continue working on this project exactly where we left off, copy and paste the following prompt into your next Gemini session:

> **"Read the `PROJECT_STATUS.md` and `README.md`. I want to continue the implementation of the DCF tool (DCF by Kong). Analyze the current state and suggest the next improvements."**

---

## 📅 Progress Summary
- **UI/UX:** Added Financial Ratios section and enhanced the Price Chart with technical indicators.
- **Backend:** Updated API to fetch comprehensive fundamental data and hardened build process against type errors.
- **Reliability:** Enforced critical mandates for AI feedback and security (RLS).
- **Hardening (April 2026):** Fixed critical DCF validation bugs (division by zero), hardened AI JSON parsing, memoized expensive components, fixed auth memory leak, and resolved Next.js 16 Turbopack compatibility.

---

## ⚙️ Development (Local)
1. **Install:** `npm install`
2. **Configure:** Create a `.env.local` file with:
   - `GEMINI_API_KEY=...`
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
3. **Run:** `npm run dev`
