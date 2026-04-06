# DCF by Kong

A professional-grade web application to perform Advanced 3-Stage Discounted Cash Flow (DCF) analysis on global stocks, featuring real-time financial data fetching and an integrated AI research analyst powered by Google Gemini.

**Live Site:** [https://dcf-kong.vercel.app](https://dcf-kong.vercel.app)

---

## 🌟 Key Features
- **Advanced 3-Stage DCF:** Realistic valuation modeling with Initial High-Growth, Linear Transition (Step-down), and Terminal Perpetuity phases.
- **Net Debt Adjustment:** Accurate calculation of Equity Value per Share by factoring in Total Cash and Total Debt.
- **PWA Optimized:** Installable as a standalone app on iOS, Android, and Desktop for a native experience.
- **Global Stock Support:** Advanced scraping for US, HK, CN, KLSE, SGX, and LSE stocks.
- **Smart AI Search:** Search by company name (e.g., "Tencent" or "Apple"); Gemini automatically resolves the correct ticker and suggests alternatives.
- **AI Research Assistant:** Automatically researches and suggests DCF parameters, including transition periods and peer comparison.
- **Interactive Visualization:** 5-year historical price and 3-stage FCF projection charts with clear stage-by-stage breakdowns.
- **User Dashboard:** Secure OTP-based authentication via Supabase to save and manage complex analyses.
- **Professional Reports:** Export your full valuation as a clean PDF summary.

---

## 🚀 How to Resume This Session
To continue working on this project exactly where we left off, copy and paste the following prompt into your next Gemini session:

> **"Read the `PROJECT_STATUS.md` and `README.md`. I want to continue the implementation of the DCF tool (DCF by Kong). Analyze the current state and suggest the next improvements."**

---

## 📅 Final Progress Summary
- **UI/UX:** Fully responsive PWA dashboard with matching headers for valuation and company info.
- **Charts:** Enhanced Recharts visualization showing 3 distinct projection stages with interactive tooltips.
- **Auth:** Hardened OTP flow designed specifically for standalone iOS/Android installations.
- **Backend:** High-performance Next.js API utilizing dual-model AI logic (`Gemini 3.1 Flash Lite Preview` & `Gemini 2.5 Flash`) for speed and accuracy.

---

## ⚙️ Development (Local)
1. **Install:** `npm install`
2. **Configure:** Create a `.env.local` file with:
   - `GEMINI_API_KEY=...`
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
3. **Run:** `npm run dev`
