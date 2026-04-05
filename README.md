# DCF by Kong

A professional-grade web application to perform Discounted Cash Flow (DCF) analysis on global stocks, featuring real-time financial data fetching and an integrated AI research analyst powered by Google Gemini.

**Live Site:** [https://dcf-kong.vercel.app](https://dcf-kong.vercel.app)

---

## 🌟 Key Features
- **Global Stock Support:** Advanced scraping for US, HK, CN, KLSE, SGX, and LSE stocks.
- **AI Research Assistant:** Automatically researches and suggests DCF parameters using Gemini Flash.
- **AI Data Recovery:** Smart fallback that uses AI to find missing historical financials when Yahoo Finance is incomplete.
- **Interactive Visualization:** 5-year historical price and FCF charts with intrinsic value overlays.
- **Scenario Analysis:** One-click stress testing for Bear, Base, and Bull cases.
- **User Dashboard:** Secure Magic Link authentication via Supabase to save and manage your analyses.
- **Professional Reports:** Export your full valuation as a clean PDF summary.

---

## 🚀 How to Resume This Session
To continue working on this project exactly where we left off, copy and paste the following prompt into your next Gemini session:

> **"Read the `PROJECT_STATUS.md` and `README.md`. I want to continue the implementation of the DCF tool (DCF by Kong). Analyze the current state and suggest the next improvements."**

---

## 📅 Final Progress Summary
- **UI/UX:** Fully responsive dashboard with a cohesive sidebar for parameters and history.
- **Charts:** Multi-layered interactive charts using `recharts` and `html-to-image` for high-quality SVG/PNG rendering.
- **Backend:** Robust Next.js API with deep scanning capabilities for international stock data.
- **Security:** Hardened production build with encrypted environment variables and Supabase RLS policies.

---

## ⚙️ Development (Local)
1. **Install:** `npm install`
2. **Configure:** Create a `.env.local` file with:
   - `GEMINI_API_KEY=...`
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
3. **Run:** `npm run dev`
