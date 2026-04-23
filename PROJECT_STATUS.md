# Project Status: DCF Analysis Tool (DCF by Kong)

## 🚀 Current State
A professional-grade, fully deployed web application for Discounted Cash Flow (DCF) analysis. The tool integrates real-time stock data, historical financial analysis, and AI-driven research. Now fully optimized as a Progressive Web App (PWA) with advanced 3-stage valuation logic and technical/fundamental insights.

### 🏗️ Technical Architecture
- **Frontend:** Next.js 16 (App Router), Tailwind CSS v4, Lucide Icons, Recharts.
- **Backend:** Next.js Route Handlers, `yahoo-finance2` (Deep Scraper).
- **Database/Auth:** Supabase (Auth OTP + Postgres Database).
- **AI Layer:** Google Gemini AI (`gemma-4-31b-it`).
- **Deployment:** Vercel (Production Ready).
- **Mobile:** PWA (Progressive Web App) with standalone window support.

### ✅ Completed Milestones
1.  **Advanced DCF Engine:**
    - **3-Stage Growth Model:** Initial High Growth, Linear Transition (Step-down), and Terminal Perpetuity phases.
    - **Net Debt Adjustment:** Enterprise Value to Equity Value bridge (EV + Cash - Debt).
    - Real-time sliders for WACC, 3-Stage Growth, and Time Horizons.
2.  **Financial Ratio Analysis:**
    - **Fundamental Ratios:** Added a dedicated section for ROE, ROA, Debt/Equity, Current Ratio, and Operating Margin.
    - Real-time extraction from Yahoo Finance with fallback logic.
3.  **Technical Indicators:**
    - **Price Chart Enhancements:** Added a 12-Month Moving Average (MA12) overlay to the 5Y price chart.
    - **RSI(14):** Integrated Relative Strength Index calculation with Overbought (>70) and Oversold (<30) visual indicators.
4.  **Data Visualization:**
    - **Enhanced FCF Chart:** Color-coded visualization showing History, Initial Projection, and Transition phases.
    - **3-Stage Summary Table:** Clear breakdown of growth rates and durations for each stage.
5.  **Progressive Web App (PWA):**
    - Fully installable on iOS, Android, and Desktop.
    - Custom standalone window mode (no browser address bar).
    - **OTP Authentication:** Hardened OTP flow specifically for standalone installation sandboxes.
6.  **Gemini AI Integration:**
    - **AI Research Assistant:** Automatically researches and suggests DCF parameters.
    - **Research Indicator:** (CRITICAL) Restored and hardened the "Gemini is Researching" visual feedback system.

### ⚠️ CRITICAL MANDATES (DO NOT REMOVE)
- **AI FEEDBACK UI:** Never remove or disable the "Gemini is Researching" or "AI Assistant" loading indicators in the DCF tool. These MUST remain visible whenever `aiLoading` is true to provide visual feedback during background AI analysis.
- **SECURITY:** Always ensure Row Level Security (RLS) is enabled on Supabase tables (specifically `public.analyses`).
- **PWA:** Maintain standalone window support for iOS/Android installations.

7.  **Bug Fixes & Hardening (April 2026):**
    - **DCF Input Validation:** Added guards for WACC <= Terminal Growth (division by zero) and zero shares outstanding. Returns structured error with UI warning banner.
    - **AI JSON Parsing:** Replaced greedy regex with balanced-brace extractor that tries markdown code fences first, preventing mis-parsed AI responses.
    - **Performance:** Memoized SensitivityTable (React.memo + useMemo for 25-cell DCF grid). Fixed StockPriceChart data mutation (deep copy instead of mutating parent state).
    - **Auth Leak Fix:** Fixed Supabase auth listener memory leak (missing unsubscribe on cleanup).
    - **Turbopack Compat:** Added empty `turbopack: {}` config to silence Next.js 16 warning from PWA webpack plugin.
    - **Supabase Init:** Cleaned up client initialization with proper `isSupabaseConfigured` gating.

8.  **Code Review Hardening (2026-04-23):**
    - **Supabase defense-in-depth:** Added `.eq("user_id", user.id)` to `fetchSavedAnalyses` and `deleteAnalysis` so RLS is not the sole access boundary.
    - **Chat UX:** `handleGeminiChat` restructured with explicit early returns — `peers`, `resolve-ticker`, `all-in-one`, `research`, and `combined` no longer leak raw JSON blobs into the chat panel.
    - **AI param application:** Extracted `applyDcfParams(params)` using `typeof === "number"` checks instead of truthy — valid `0` values (e.g. `transitionYears: 0`) are now respected.
    - **DCF recompute:** Dropped the `fcf !== 0` gate; negative/zero FCF now computes so loss-makers render a meaningful intrinsic value.
    - **PDF pagination:** `downloadPDF` now slices the rendered PNG across A4 pages via negative-Y `addImage` offsets — tall reports no longer clip.
    - **Race guards:** `AbortController` refs on `fetchStockData` and `handleGeminiChat` cancel in-flight requests on new ticker/chat submissions.
    - **Prompt sanitation:** `/api/chat` strips `\n\r{}\`` and caps ticker/context length before interpolating into prompts.
    - **Ticker aliases:** Removed the Geely hardcode from the resolve prompt; moved to a `TICKER_ALIASES` table checked before the AI call.
    - **Observability:** `/api/stocks` now returns `{ peers, failed }` so the client logs which peers couldn't be fetched. Debug payload in `/api/stock` is gated behind `NODE_ENV !== 'production'`.
    - **History hygiene:** Chat history is only forwarded when `type === "chat"` — eliminates linear token growth from JSON responses being re-uploaded.
    - **Auth consolidation:** New `src/lib/auth-context.tsx` (`AuthProvider` + `useAuth`) replaces duplicated `getUser` + `onAuthStateChange` subscriptions that lived in both `page.tsx` and `Auth.tsx`.
    - **Types:** `DCFResult` and `DcfParams` exported from `src/lib/dcf.ts`. `any` eliminated from `page.tsx` via `Peer`, `SavedAnalysis`, `ChatMessage`, `AiDcfParams`, `ChatType`. Pre-existing `any` usages in chart components also cleaned up.
    - **A11y:** Dropped `userScalable: false` from viewport.

### 📍 Next Steps
1.  **Multi-Scenario Comparison:** Allow users to save and compare Bear, Base, and Bull cases side-by-side.
2.  **Portfolio Tracking:** Aggregate valuation dashboard for all saved analyses.
3.  **Explicit "Set as Base" control:** `baseParams` currently only updates on AI research — a manual button would let users anchor bull/bear scenarios around their edited values.

---

## 🔗 History
- Initial Checkpoint: `98d3ede`
- Auth & Database Checkpoint: `2510bd0`
- Final Polish Checkpoint: `a5fdb91`
- Advanced DCF & PWA Checkpoint: `e793993`
- Financial & Technical Checkpoint: `aa7d490`
- Bug Fixes & Hardening Checkpoint: `3b627e6`
- Code Review Hardening Checkpoint: _pending commit_ (Latest)
