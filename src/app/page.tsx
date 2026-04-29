"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as Slider from "@radix-ui/react-slider";
import {
  Search, Info, MessageSquare, Loader2, Download, Save, History, Trash2,
  AlertCircle, ShieldAlert, X, Send, AlertTriangle, Share2, FileSpreadsheet,
} from "lucide-react";
import { calculateDCF, DCFResult } from "@/lib/dcf";
import { SensitivityTable } from "@/components/SensitivityTable";
import { StockPriceChart } from "@/components/StockPriceChart";
import { HistoricalFCFChart } from "@/components/HistoricalFCFChart";
import { PeerComparisonTable } from "@/components/PeerComparisonTable";
import { AuthUI } from "@/components/Auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

interface StockData {
  symbol: string;
  price?: number | null;
  currency?: string;
  shortName?: string;
  sharesOutstanding: number | null;
  marketCap: number | null;
  peRatio: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  dividendYield: number | null;
  beta: number | null;
  totalCash: number;
  totalDebt: number;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  operatingMargins: number | null;
  freeCashFlow: number | null;
  historicalFCF: { date: string; fcf: number; ocf?: number; capex?: number }[];
  sector?: string;
  industry?: string;
  history: { date: string; price: number }[];
}

interface Peer {
  symbol: string;
  shortName: string;
  price: number;
  currency: string;
  peRatio: number | null;
  forwardPE: number | null;
  priceToSales: number | null;
  priceToBook: number | null;
  dividendYield: number | null;
  marketCap: number;
}

interface SavedAnalysis {
  id: string;
  user_id: string;
  ticker: string;
  company_name: string | null;
  fcf: number;
  wacc: number;
  growth_rate: number;
  terminal_growth: number;
  years: number;
  transition_years: number | null;
  total_cash: number | null;
  total_debt: number | null;
  shares: number;
  created_at: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AiDcfParams {
  fcf?: number;
  wacc?: number;
  growthRate?: number;
  terminalGrowth?: number;
  years?: number;
  transitionYears?: number;
  historicalFCF?: { date: string; fcf: number }[];
  reasoning?: string;
}

type ChatType = "chat" | "research" | "commentary" | "combined" | "peers" | "resolve-ticker" | "all-in-one";

function extractJSON(text: string): string | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const trimmed = fenceMatch[1].trim();
    try { JSON.parse(trimmed); return trimmed; } catch { /* fall through */ }
  }
  let depth = 0;
  let lastEnd = -1;
  let lastStart = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === '}') { if (depth === 0) lastEnd = i; depth++; }
    else if (text[i] === '{') { depth--; if (depth === 0 && lastEnd !== -1) { lastStart = i; break; } }
  }
  if (lastStart !== -1 && lastEnd !== -1) {
    return text.slice(lastStart, lastEnd + 1);
  }
  return null;
}

/* ─── Tooltip badge ─── */
function Tip({ tip }: { tip: string }) {
  return (
    <div className="tooltip-wrap">
      <div className="tooltip-icon">?</div>
      <div className="tooltip-box">{tip}</div>
    </div>
  );
}

/* ─── Slider row with tooltip ─── */
function SliderRow({
  label, value, min, max, step, formatValue, onChange, tip,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
  onChange: (v: number) => void;
  tip?: string;
}) {
  return (
    <div className="slider-wrap">
      <div className="slider-header">
        <div className="slider-label-row">
          <span>{label}</span>
          {tip && <Tip tip={tip} />}
        </div>
        <span className="slider-value">{formatValue(value)}</span>
      </div>
      <Slider.Root
        className="relative flex items-center select-none touch-none w-full h-5"
        value={[value]}
        max={max}
        min={min}
        step={step}
        onValueChange={(vals) => onChange(vals[0])}
      >
        <Slider.Track style={{ background: "var(--surface3)" }} className="relative grow rounded-full h-[4px]">
          <Slider.Range style={{ background: "var(--blue)" }} className="absolute rounded-full h-full" />
        </Slider.Track>
        <Slider.Thumb
          style={{ background: "var(--surface)", border: "2px solid var(--blue)", boxShadow: "var(--shadow-sm)" }}
          className="block w-4 h-4 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Slider.Root>
    </div>
  );
}

/* ─── Margin of Safety bar ─── */
function MoSBar({ mos }: { mos: number }) {
  const pct = Math.min(100, Math.max(0, mos));
  const fillColor = mos < 0 ? "var(--red)" : mos < 15 ? "var(--amber)" : "var(--green)";
  const fillLabel = mos < 0 ? "Overvalued" : mos < 15 ? "Thin margin" : "Adequate MoS";
  return (
    <div className="mos-bar-section">
      <div className="mos-bar-header">
        <span className="mos-bar-label">Margin of Safety</span>
        <span className="mos-bar-pct" style={{ color: fillColor }}>
          {mos >= 0 ? "+" : ""}{mos.toFixed(1)}% — {fillLabel}
        </span>
      </div>
      <div className="mos-bar-track">
        <div className="mos-bar-fill" style={{ width: `${pct}%`, background: fillColor }} />
      </div>
      <div className="mos-zones">
        <span>0%</span><span>15% (min)</span><span>30% (ideal)</span><span>50%+</span>
      </div>
    </div>
  );
}

/* ─── Scenario range card ─── */
function ScenarioRangeCard({
  bearVal, baseVal, bullVal, price, currency,
}: {
  bearVal: number;
  baseVal: number;
  bullVal: number;
  price: number;
  currency: string;
}) {
  const lo = Math.min(bearVal, price) * 0.85;
  const hi = Math.max(bullVal, price) * 1.1;
  const span = hi - lo || 1;
  const toX = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));

  const rows = [
    { label: "BEAR", val: bearVal, color: "var(--red)" },
    { label: "BASE", val: baseVal, color: "var(--blue)" },
    { label: "BULL", val: bullVal, color: "var(--green)" },
  ];

  return (
    <div className="scenario-range-card">
      <div className="range-title">
        <span>Intrinsic Value Range</span>
        <div style={{ display: "flex", gap: 8, fontSize: 10, color: "var(--text3)" }}>
          <span style={{ color: "var(--red)", fontWeight: 700 }}>Bear</span>
          <span>·</span>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>Base</span>
          <span>·</span>
          <span style={{ color: "var(--green)", fontWeight: 700 }}>Bull</span>
        </div>
      </div>

      {rows.map((s) => (
        <div key={s.label} className="range-row">
          <span className="range-scenario-label" style={{ color: s.color }}>{s.label}</span>
          <div className="range-bar-wrap">
            <div className="range-track" />
            <div className="range-price-line" style={{ left: `${toX(price)}%` }} />
            <div
              style={{
                position: "absolute",
                left: `${Math.min(toX(price), toX(s.val))}%`,
                width: `${Math.abs(toX(s.val) - toX(price))}%`,
                height: 4,
                background: s.val >= price ? "rgba(22,163,74,.25)" : "rgba(220,38,38,.25)",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
            <div
              className="range-marker"
              title={`${currency}${s.val.toFixed(2)}`}
              style={{ left: `${toX(s.val)}%`, background: s.color }}
            />
          </div>
          <span className="range-val" style={{ color: s.color }}>
            {currency}{s.val.toFixed(2)}
          </span>
        </div>
      ))}

      <div style={{ marginTop: 6, paddingLeft: 48, position: "relative", height: 14 }}>
        <div className="range-price-label" style={{ left: `${toX(price)}%`, top: 0 }}>
          Mkt {currency}{price.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

const SLIDER_TIPS = {
  wacc: "Weighted Average Cost of Capital — the discount rate. Higher WACC = lower intrinsic value. Typical range: 7–12%.",
  growth: "Near-term FCF growth rate during the initial period. Anchor to historical CAGR and analyst estimates.",
  termGrowth: "Perpetual growth rate after the explicit forecast. Should not exceed long-run GDP (~2–3%).",
  years: "Number of years for the initial high-growth stage before transition.",
  transitionYears: "Years to fade growth from initial to terminal rate. 3-stage models use 5–10 years.",
};

export default function Home() {
  const { user } = useAuth();

  const [ticker, setTicker] = useState("");
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  const [fcf, setFcf] = useState(0);
  const [wacc, setWacc] = useState(10);
  const [growthRate, setGrowthRate] = useState(5);
  const [terminalGrowth, setTerminalGrowth] = useState(2);
  const [years, setYears] = useState(5);
  const [sharesOutstanding, setSharesOutstanding] = useState(0);
  const [transitionYears, setTransitionYears] = useState(5);
  const [totalCash, setTotalCash] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);

  const [peers, setPeers] = useState<Peer[]>([]);
  const [peersLoading, setPeersLoading] = useState(false);

  const [baseParams, setBaseParams] = useState({ wacc: 10, growthRate: 5 });
  const [scenario, setScenarioName] = useState<"bear" | "base" | "bull">("base");

  const [dcfResult, setDcfResult] = useState<DCFResult | null>(null);

  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hello! Search for a stock ticker to start our analysis. I can help you research initial DCF parameters and discuss the company's fundamentals." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // UI state
  const [dark, setDark] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const stockAbortRef = useRef<AbortController | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("dcf-theme");
      if (saved === "dark") setDark(true);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    window.localStorage.setItem("dcf-theme", dark ? "dark" : "light");
  }, [dark, mounted]);

  // auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, chatOpen]);

  // unread badge: increment on assistant message when chat is closed
  const lastMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > lastMsgCountRef.current) {
      const newest = messages[messages.length - 1];
      if (!chatOpen && newest?.role === "assistant") {
        setUnreadCount((c) => c + (messages.length - lastMsgCountRef.current));
      }
    }
    lastMsgCountRef.current = messages.length;
  }, [messages, chatOpen]);

  useEffect(() => {
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  const fetchSavedAnalyses = useCallback(async (uid: string) => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (data) setSavedAnalyses(data as SavedAnalysis[]);
    if (error) console.error("Error fetching saved analyses:", error);
  }, []);

  useEffect(() => {
    if (user && isSupabaseConfigured) fetchSavedAnalyses(user.id);
    else setSavedAnalyses([]);
  }, [user, fetchSavedAnalyses]);

  const applyDcfParams = useCallback((params: AiDcfParams) => {
    if (typeof params.fcf === "number") setFcf(params.fcf);
    if (typeof params.wacc === "number") {
      setWacc(params.wacc);
      setBaseParams(prev => ({ ...prev, wacc: params.wacc as number }));
    }
    if (typeof params.growthRate === "number") {
      setGrowthRate(params.growthRate);
      setBaseParams(prev => ({ ...prev, growthRate: params.growthRate as number }));
    }
    if (typeof params.terminalGrowth === "number") setTerminalGrowth(params.terminalGrowth);
    if (typeof params.years === "number") setYears(params.years);
    if (typeof params.transitionYears === "number") setTransitionYears(params.transitionYears);

    if (params.historicalFCF && params.historicalFCF.length > 0) {
      setStockData(prev => {
        if (!prev) return null;
        if (!prev.historicalFCF || prev.historicalFCF.length === 0) {
          return { ...prev, historicalFCF: params.historicalFCF! };
        }
        return prev;
      });
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const saveAnalysis = async () => {
    if (!isSupabaseConfigured) return alert("Database not configured. Set Supabase keys in .env.local");
    if (!user) return alert("Please login to save your analysis!");
    if (!ticker) return;

    setSaveLoading(true);
    const { error } = await supabase.from("analyses").insert({
      user_id: user.id,
      ticker,
      company_name: stockData?.shortName || ticker,
      fcf,
      wacc,
      growth_rate: growthRate,
      terminal_growth: terminalGrowth,
      years,
      transition_years: transitionYears,
      total_cash: totalCash,
      total_debt: totalDebt,
      shares: sharesOutstanding,
    });

    if (error) alert(error.message);
    else {
      await fetchSavedAnalyses(user.id);
      showToast("Analysis saved ✓");
    }
    setSaveLoading(false);
  };

  const loadAnalysis = (item: SavedAnalysis) => {
    setTicker(item.ticker);
    setFcf(item.fcf);
    setWacc(item.wacc);
    setGrowthRate(item.growth_rate);
    setTerminalGrowth(item.terminal_growth);
    setYears(item.years);
    setTransitionYears(item.transition_years ?? 5);
    setTotalCash(item.total_cash ?? 0);
    setTotalDebt(item.total_debt ?? 0);
    setSharesOutstanding(item.shares);
    fetchStockData(item.ticker, true);
  };

  const deleteAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSupabaseConfigured || !user) return;
    const { error } = await supabase
      .from("analyses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (!error) fetchSavedAnalyses(user.id);
  };

  const setScenario = (type: "bear" | "base" | "bull") => {
    setScenarioName(type);
    if (type === "bear") {
      setWacc(baseParams.wacc + 1.5);
      setGrowthRate(baseParams.growthRate * 0.5);
    } else if (type === "bull") {
      setWacc(Math.max(4, baseParams.wacc - 1));
      setGrowthRate(baseParams.growthRate * 1.5);
    } else {
      setWacc(baseParams.wacc);
      setGrowthRate(baseParams.growthRate);
    }
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setLoading(true);
    try {
      const dataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        backgroundColor: dark ? "#0b0f1a" : "#ffffff",
        style: { background: dark ? "#0b0f1a" : "white" }
      });
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let remaining = pdfHeight;
      let pageIndex = 0;
      while (remaining > 0) {
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(dataUrl, "PNG", 0, -pageIndex * pageHeight, pdfWidth, pdfHeight);
        remaining -= pageHeight;
        pageIndex += 1;
      }
      pdf.save(`${ticker || "stock"}-dcf-analysis.pdf`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "PDF generation failed";
      setError(`Failed to generate PDF: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!dcfResult || dcfResult.projectedFCF.length === 0) {
      showToast("No DCF data to export");
      return;
    }
    const r = wacc / 100;
    const rows: string[][] = [["Period", "Year", "FCF", "Growth %", "Discount Factor", "PV FCF"]];
    const baseYear = new Date().getFullYear();
    dcfResult.projectedFCF.forEach((f, i) => {
      const t = i + 1;
      const df = 1 / Math.pow(1 + r, t);
      rows.push([
        t <= years ? "Initial" : "Transition",
        String(baseYear + t),
        f.toFixed(2),
        (dcfResult.annualGrowthRates[i] ?? 0).toFixed(2),
        df.toFixed(4),
        (f * df).toFixed(2),
      ]);
    });
    rows.push(["Terminal", "PV", dcfResult.terminalValue.toFixed(2), terminalGrowth.toFixed(2), "—", dcfResult.presentTerminalValue.toFixed(2)]);
    rows.push([]);
    rows.push(["Summary"]);
    rows.push(["Enterprise Value", dcfResult.enterpriseValue.toFixed(2)]);
    rows.push(["Equity Value", dcfResult.equityValue.toFixed(2)]);
    rows.push(["Value per Share", dcfResult.valuePerShare.toFixed(2)]);

    const csv = rows.map((r) => r.map((c) => /[,"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ticker || "stock"}-dcf.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported ✓");
  };

  const handleShare = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard?.writeText(window.location.href)
      .then(() => showToast("Link copied to clipboard ✓"))
      .catch(() => showToast("Failed to copy link"));
  };

  const fetchStockData = async (activeTickerParam?: string, skipAi?: boolean) => {
    let activeTicker = (activeTickerParam || ticker).trim();
    if (!activeTicker) return;

    stockAbortRef.current?.abort();
    const controller = new AbortController();
    stockAbortRef.current = controller;

    setLoading(true);
    setError("");
    setPeers([]);

    try {
      let res = await fetch(`/api/stock?ticker=${encodeURIComponent(activeTicker)}`, { signal: controller.signal });
      let data = await res.json();

      if (data.error) {
        const resolution = await handleGeminiChat(activeTicker, "resolve-ticker");

        if (resolution && resolution.ticker && resolution.confidence === "high") {
          activeTicker = resolution.ticker;
          setTicker(activeTicker);

          res = await fetch(`/api/stock?ticker=${encodeURIComponent(activeTicker)}`, { signal: controller.signal });
          data = await res.json();
          if (data.error) throw new Error(data.error);
        } else if (resolution && resolution.suggestions && resolution.suggestions.length > 0) {
          const suggestionList = resolution.suggestions.map((s: string) => `'${s}'`).join(" or ");
          throw new Error(`Could not find an exact match for "${activeTicker}". Try searching for: ${suggestionList}`);
        } else {
          throw new Error(`Could not find a stock ticker for "${activeTicker}".`);
        }
      }

      if (controller.signal.aborted) return;

      setStockData(data);

      if (data.freeCashFlow !== null && data.freeCashFlow !== undefined) {
        setFcf(data.freeCashFlow);
      }
      if (data.sharesOutstanding) setSharesOutstanding(data.sharesOutstanding);
      if (data.totalCash !== undefined) setTotalCash(data.totalCash);
      if (data.totalDebt !== undefined) setTotalDebt(data.totalDebt);

      if (!skipAi) {
        handleGeminiChat(`Comprehensive research for ${data.symbol}`, "all-in-one", data.symbol);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGeminiChat = async (
    input: string,
    type: ChatType = "chat",
    overrideTicker?: string
  ): Promise<{ ticker?: string; confidence?: string; suggestions?: string[] } | undefined> => {
    const currentTicker = overrideTicker || ticker;
    if (!currentTicker && type !== "chat") return;

    if (type === "chat") {
      setMessages(prev => [...prev, { role: "user", content: input }]);
    }

    const isPeerLike = type === "peers" || type === "resolve-ticker" || type === "all-in-one";
    if (isPeerLike) setPeersLoading(true);
    else setAiLoading(true);

    chatAbortRef.current?.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      const historyForApi = type === "chat" ? messages : [];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          ticker: currentTicker,
          type,
          context: input,
          history: historyForApi,
        }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      if (type === "all-in-one") {
        try {
          const jsonStr = extractJSON(data.text);
          if (jsonStr) {
            const allData = JSON.parse(jsonStr);

            if (allData.dcf) applyDcfParams(allData.dcf as AiDcfParams);

            if (allData.peers && Array.isArray(allData.peers)) {
              const tickersToFetch = Array.from(new Set([currentTicker, ...allData.peers])).join(",");
              const peersRes = await fetch(`/api/stocks?tickers=${encodeURIComponent(tickersToFetch)}`, { signal: controller.signal });
              const peersJson = await peersRes.json();
              if (Array.isArray(peersJson.peers)) {
                setPeers(peersJson.peers);
                if (Array.isArray(peersJson.failed) && peersJson.failed.length > 0) {
                  console.warn("Peer fetch failed for:", peersJson.failed);
                }
              }
            }

            const analysisText = typeof allData.analysis === "string" && allData.analysis.trim()
              ? allData.analysis
              : data.text;
            setMessages(prev => [...prev, { role: "assistant", content: analysisText }]);
          }
        } catch (e) {
          console.error("Failed to parse all-in-one data", e);
        }
        return;
      }

      if (type === "resolve-ticker") {
        try {
          const jsonStr = extractJSON(data.text);
          return JSON.parse(jsonStr || data.text);
        } catch (e) {
          console.error("Failed to parse resolution", e);
          return undefined;
        }
      }

      if (type === "peers") {
        try {
          const peerTickers = JSON.parse(data.text);
          if (Array.isArray(peerTickers)) {
            const tickersToFetch = Array.from(new Set([currentTicker, ...peerTickers])).join(",");
            const peersRes = await fetch(`/api/stocks?tickers=${encodeURIComponent(tickersToFetch)}`, { signal: controller.signal });
            const peersJson = await peersRes.json();
            if (Array.isArray(peersJson.peers)) setPeers(peersJson.peers);
          }
        } catch (e) {
          console.error("Failed to parse or fetch peers", e);
        }
        return;
      }

      if (type === "combined" || type === "research") {
        const jsonStr = extractJSON(data.text);
        if (jsonStr) {
          try {
            const params = JSON.parse(jsonStr) as AiDcfParams;
            applyDcfParams(params);
            if (params.reasoning) {
              setMessages(prev => [...prev, { role: "assistant", content: params.reasoning! }]);
            }
          } catch (e) {
            console.error("Failed to parse AI parameters", e);
          }
        }
        return;
      }

      setMessages(prev => [...prev, { role: "assistant", content: data.text }]);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${errorMessage}. Please ensure GEMINI_API_KEY is set in your environment.` }]);
    } finally {
      setAiLoading(false);
      setPeersLoading(false);
      setChatInput("");
    }
  };

  useEffect(() => {
    if (sharesOutstanding > 0) {
      const result = calculateDCF(fcf, growthRate, terminalGrowth, wacc, years, sharesOutstanding, transitionYears, totalCash, totalDebt);
      setDcfResult(result);
    }
  }, [fcf, growthRate, terminalGrowth, wacc, years, sharesOutstanding, transitionYears, totalCash, totalDebt]);

  // Bear / bull intrinsic values for the scenario range card
  const bearIntrinsic = useMemo(() => {
    if (!sharesOutstanding) return 0;
    const r = calculateDCF(fcf, baseParams.growthRate * 0.5, terminalGrowth, baseParams.wacc + 1.5, years, sharesOutstanding, transitionYears, totalCash, totalDebt);
    return r.error ? 0 : r.valuePerShare;
  }, [fcf, baseParams, terminalGrowth, years, sharesOutstanding, transitionYears, totalCash, totalDebt]);

  const bullIntrinsic = useMemo(() => {
    if (!sharesOutstanding) return 0;
    const r = calculateDCF(fcf, baseParams.growthRate * 1.5, terminalGrowth, Math.max(4, baseParams.wacc - 1), years, sharesOutstanding, transitionYears, totalCash, totalDebt);
    return r.error ? 0 : r.valuePerShare;
  }, [fcf, baseParams, terminalGrowth, years, sharesOutstanding, transitionYears, totalCash, totalDebt]);

  const baseIntrinsic = useMemo(() => {
    if (!sharesOutstanding) return 0;
    const r = calculateDCF(fcf, baseParams.growthRate, terminalGrowth, baseParams.wacc, years, sharesOutstanding, transitionYears, totalCash, totalDebt);
    return r.error ? 0 : r.valuePerShare;
  }, [fcf, baseParams, terminalGrowth, years, sharesOutstanding, transitionYears, totalCash, totalDebt]);

  // Derived
  const intrinsic = dcfResult?.valuePerShare ?? 0;
  const marketPrice = stockData?.price ?? 0;
  const upside = marketPrice > 0 ? ((intrinsic - marketPrice) / marketPrice) * 100 : 0;
  const isUp = intrinsic > marketPrice;
  const mos = isUp && intrinsic > 0 ? ((intrinsic - marketPrice) / intrinsic) * 100 : 0;
  const mosColor = mos < 0 ? "var(--red)" : mos < 15 ? "var(--amber)" : "var(--green)";
  const tvPct = dcfResult && dcfResult.enterpriseValue > 0
    ? (dcfResult.presentTerminalValue / dcfResult.enterpriseValue) * 100
    : 0;
  const currency = stockData?.currency || "$";

  if (!mounted) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text3)" }}>
          <Loader2 className="h-8 w-8 animate-spin" />
          <p style={{ fontWeight: 500 }}>Initializing DCF Dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {!isSupabaseConfigured && (
        <div className="config-warning">
          <ShieldAlert />
          <span>
            <strong>Database & Auth disabled:</strong> Add{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code>.env.local</code> to enable saving features.
          </span>
        </div>
      )}

      {/* ── TOPBAR ── */}
      <div className="topbar">
        <div>
          <div className="logo">DCF<span>Kong</span></div>
          <div className="logo-sub">by Kong Ooi Tan</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="search-box">
            <Search />
            <input
              type="text"
              placeholder="Ticker (e.g. AAPL, 0700.HK)"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && fetchStockData()}
            />
          </div>
          <button className="fetch-btn" onClick={() => fetchStockData()} disabled={loading}>
            {loading ? "..." : "Fetch"}
          </button>
          {aiLoading && (
            <div className="ai-pill">
              <Loader2 />
              Gemini researching
            </div>
          )}
        </div>
        <div className="topbar-right">
          <button className="csv-btn" onClick={exportCSV} disabled={!dcfResult || !!dcfResult?.error}>
            <FileSpreadsheet style={{ width: 13, height: 13 }} />
            Export CSV
          </button>
          <button className="share-btn" onClick={handleShare}>
            <Share2 style={{ width: 13, height: 13 }} />
            Share
          </button>
          <button className="icon-btn dark-btn" onClick={() => setDark((d) => !d)} title="Toggle dark mode">
            {dark ? "☀️" : "🌙"}
          </button>
          <button className="icon-btn" onClick={downloadPDF} disabled={!dcfResult || loading} title="Download PDF">
            {loading ? <Loader2 className="animate-spin" /> : <Download />}
          </button>
          <AuthUI />
        </div>
      </div>

      {/* ── STICKY VALUATION HEADER ── */}
      {stockData && (
        <div className="sticky-val-bar dcf-scroll">
          <span className="sval-ticker">{stockData.symbol}</span>
          <span className="sval-name">{stockData.shortName}</span>
          <div className="sval-divider" />
          <div className="sval-item">
            <div className="sval-label">Market Price</div>
            <div className="sval-value">{currency}{marketPrice.toFixed(2)}</div>
          </div>
          <div className="sval-divider" />
          <div className="sval-item">
            <div className="sval-label">Intrinsic Value</div>
            <div className={`sval-value ${isUp ? "green" : "red"}`}>{currency}{intrinsic.toFixed(2)}</div>
          </div>
          <div className="sval-divider" />
          <div className="sval-item">
            <div className="sval-label">Upside / Downside</div>
            <div className={`sval-value ${isUp ? "green" : "red"}`}>{upside >= 0 ? "+" : ""}{upside.toFixed(1)}%</div>
          </div>
          <div className="sval-divider" />
          <div className="sval-item" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <div>
              <div className="sval-label">MoS</div>
              <div className="sval-value" style={{ color: mosColor, fontSize: 12 }}>{mos.toFixed(1)}%</div>
            </div>
            <div className="mos-track">
              <div className="mos-fill" style={{ width: `${Math.min(100, Math.max(0, mos))}%`, background: mosColor }} />
            </div>
          </div>
          <div className="sval-divider" />
          <div className="sval-item">
            <div className="sval-label">TV %</div>
            <div className="sval-value" style={{ color: tvPct > 75 ? "var(--amber)" : "var(--text)" }}>{tvPct.toFixed(0)}%</div>
          </div>
          <div className="scenario-pills">
            {(["bear", "base", "bull"] as const).map((s) => (
              <button
                key={s}
                className={`scenario-pill ${s} ${scenario === s ? "active" : ""}`}
                onClick={() => setScenario(s)}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── BODY ── */}
      <div className="dcf-body">

        {/* LEFT PANEL */}
        <div className="left-panel dcf-scroll">
          <div className="section-title">
            <Info />
            Parameters
            {isSupabaseConfigured && user && ticker && (
              <button className="save-link" onClick={saveAnalysis} disabled={saveLoading}>
                {saveLoading ? <Loader2 className="animate-spin" style={{ width: 11, height: 11 }} /> : <Save style={{ width: 11, height: 11 }} />}
                Save
              </button>
            )}
          </div>

          <div className="scenario-row">
            {(["bear", "base", "bull"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`scenario-btn-lp ${s} ${scenario === s ? "active" : ""}`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="input-label">Initial FCF (Billion {currency})</div>
          <input
            type="number"
            step="0.01"
            value={fcf}
            onChange={(e) => setFcf(Number(e.target.value))}
            className="input-field"
          />

          <div className="input-label">Shares Outstanding (Billion)</div>
          <input
            type="number"
            step="0.01"
            value={sharesOutstanding}
            onChange={(e) => setSharesOutstanding(Number(e.target.value))}
            className="input-field"
          />

          <div className="input-row">
            <div>
              <div className="input-label">Cash (B)</div>
              <input
                type="number"
                step="0.1"
                value={totalCash}
                onChange={(e) => setTotalCash(Number(e.target.value))}
                className="input-field"
              />
            </div>
            <div>
              <div className="input-label">Debt (B)</div>
              <input
                type="number"
                step="0.1"
                value={totalDebt}
                onChange={(e) => setTotalDebt(Number(e.target.value))}
                className="input-field"
              />
            </div>
          </div>

          {dcfResult && !dcfResult.error && (
            <div className="equity-box">
              <div className="equity-box-label">
                Equity Value
                <Info style={{ width: 10, height: 10 }} />
              </div>
              <div className="equity-box-value">
                {currency}{dcfResult.equityValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}B
              </div>
            </div>
          )}

          <div className="divider" />

          <SliderRow
            label="WACC"
            value={wacc}
            min={1}
            max={20}
            step={0.1}
            formatValue={(v) => `${v.toFixed(1)}%`}
            onChange={setWacc}
            tip={SLIDER_TIPS.wacc}
          />
          <SliderRow
            label="Growth Rate"
            value={growthRate}
            min={-20}
            max={50}
            step={0.5}
            formatValue={(v) => `${v.toFixed(1)}%`}
            onChange={setGrowthRate}
            tip={SLIDER_TIPS.growth}
          />
          <SliderRow
            label="Terminal Growth"
            value={terminalGrowth}
            min={0}
            max={10}
            step={0.1}
            formatValue={(v) => `${v.toFixed(1)}%`}
            onChange={setTerminalGrowth}
            tip={SLIDER_TIPS.termGrowth}
          />
          <SliderRow
            label="Initial Period"
            value={years}
            min={1}
            max={20}
            step={1}
            formatValue={(v) => `${v} yrs`}
            onChange={setYears}
            tip={SLIDER_TIPS.years}
          />
          <SliderRow
            label="Transition Period"
            value={transitionYears}
            min={0}
            max={10}
            step={1}
            formatValue={(v) => `${v} yrs`}
            onChange={setTransitionYears}
            tip={SLIDER_TIPS.transitionYears}
          />

          <button
            className="ai-research-btn"
            onClick={() => handleGeminiChat(`Suggest DCF parameters for ${ticker}`, "research")}
            disabled={aiLoading || !ticker}
          >
            <Info />
            {aiLoading ? "Researching..." : "AI Research Assistant"}
          </button>

          {user && savedAnalyses.length > 0 && (
            <>
              <div className="divider" />
              <div className="section-title">
                <History />
                My Analyses
              </div>
              {savedAnalyses.map((item) => (
                <div key={item.id} onClick={() => loadAnalysis(item)} className="history-item">
                  <div className="history-ticker">{item.ticker}</div>
                  <div className="history-name">{item.company_name || item.ticker}</div>
                  <div className="history-date">{new Date(item.created_at).toLocaleDateString()}</div>
                  <div className="history-tags">
                    <span className="history-tag">WACC {item.wacc}%</span>
                    <span className="history-tag">G {item.growth_rate}%</span>
                  </div>
                  <button className="del-btn" onClick={(e) => deleteAnalysis(item.id, e)} title="Delete">
                    <Trash2 />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel dcf-scroll">
          {error && (
            <div className="error-banner">
              <AlertCircle style={{ width: 15, height: 15 }} />
              <span>{error}</span>
            </div>
          )}

          {dcfResult?.error && (
            <div className="error-banner" style={{ background: "var(--amber-bg)", borderColor: "var(--amber-mid)", color: "var(--amber)" }}>
              <AlertTriangle style={{ width: 15, height: 15 }} />
              <span><strong>Invalid Parameters:</strong> {dcfResult.error}. Please adjust the WACC or Terminal Growth Rate sliders.</span>
            </div>
          )}

          <div ref={reportRef}>
            {/* Top cards */}
            <div className="right-grid">
              <div className="dcf-card">
                <div className="card-label">Equity Value (per Share)</div>
                <div className="card-value">
                  {currency}{dcfResult && !dcfResult.error ? dcfResult.valuePerShare.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "---"}
                </div>
                {stockData && dcfResult && !dcfResult.error && marketPrice > 0 && (
                  <div className={`card-sub ${isUp ? "up" : "down"}`}>
                    {upside >= 0 ? "+" : ""}{upside.toFixed(1)}% {isUp ? "Upside" : "Downside"}{" "}
                    <span style={{ color: "var(--text3)", fontWeight: 400 }}>from {currency}{marketPrice.toFixed(2)}</span>
                  </div>
                )}
                {stockData && dcfResult && !dcfResult.error && marketPrice > 0 && (
                  <MoSBar mos={mos} />
                )}
                {tvPct > 75 && dcfResult && !dcfResult.error && (
                  <div className="tv-warning">
                    <AlertTriangle />
                    <div>
                      <strong>Terminal value drives {tvPct.toFixed(0)}% of EV.</strong>{" "}
                      Most of this valuation depends on perpetual assumptions — review the sensitivity table for fragility against WACC/TGR changes.
                    </div>
                  </div>
                )}
              </div>

              <div className="dcf-card" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div className="card-label">Company Info</div>
                <div className="card-name" title={stockData?.shortName || ""}>
                  {stockData ? stockData.shortName : "No Data"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {stockData && <span className="card-ticker-badge">{stockData.symbol}</span>}
                  <span style={{ fontSize: 11, color: "var(--text3)" }}>
                    {stockData?.sector ? `${stockData.sector} • ${stockData.industry}` : "Search a ticker to get started"}
                  </span>
                </div>
              </div>
            </div>

            {/* Scenario range */}
            {stockData && marketPrice > 0 && baseIntrinsic > 0 && (
              <ScenarioRangeCard
                bearVal={bearIntrinsic}
                baseVal={baseIntrinsic}
                bullVal={bullIntrinsic}
                price={marketPrice}
                currency={currency}
              />
            )}

            {/* Primary metrics */}
            <div className="metrics-strip">
              {[
                { label: "P/E", val: stockData?.peRatio ? Number(stockData.peRatio).toFixed(1) : "---" },
                { label: "Fwd P/E", val: stockData?.forwardPE ? Number(stockData.forwardPE).toFixed(1) : "---" },
                { label: "P/B", val: stockData?.priceToBook ? Number(stockData.priceToBook).toFixed(1) : "---" },
                { label: "P/S", val: stockData?.priceToSales ? Number(stockData.priceToSales).toFixed(1) : "---" },
                { label: "Mkt Cap", val: stockData?.marketCap ? `${Number(stockData.marketCap).toFixed(1)}B` : "---" },
                { label: "Div Yield", val: stockData?.dividendYield ? `${Number(stockData.dividendYield).toFixed(1)}%` : "---" },
              ].map((m) => (
                <div key={m.label}>
                  <div className="metric-label">{m.label}</div>
                  <div className="metric-val">{m.val}</div>
                </div>
              ))}
            </div>

            {/* Secondary metrics */}
            <div className="metrics-strip2">
              {[
                { label: "ROE", val: stockData?.returnOnEquity ? `${Number(stockData.returnOnEquity).toFixed(1)}%` : "---" },
                { label: "ROA", val: stockData?.returnOnAssets ? `${Number(stockData.returnOnAssets).toFixed(1)}%` : "---" },
                { label: "Debt/Equity", val: stockData?.debtToEquity ? Number(stockData.debtToEquity).toFixed(2) : "---" },
                { label: "Current Ratio", val: stockData?.currentRatio ? Number(stockData.currentRatio).toFixed(2) : "---" },
                { label: "Op. Margin", val: stockData?.operatingMargins ? `${Number(stockData.operatingMargins).toFixed(1)}%` : "---" },
              ].map((m) => (
                <div key={m.label}>
                  <div className="metric-label">{m.label}</div>
                  <div className="metric-val" style={{ fontSize: 14 }}>{m.val}</div>
                </div>
              ))}
            </div>

            {/* Stock chart */}
            {stockData?.history && dcfResult && !dcfResult.error && (
              <div style={{ marginBottom: 14 }}>
                <StockPriceChart
                  history={stockData.history}
                  intrinsicValue={dcfResult.valuePerShare}
                  ticker={stockData.symbol}
                />
              </div>
            )}

            {/* Historical FCF + projections */}
            {stockData?.historicalFCF && stockData.historicalFCF.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <HistoricalFCFChart
                  data={stockData.historicalFCF}
                  projections={dcfResult?.projectedFCF}
                  growthRates={dcfResult?.annualGrowthRates}
                  initialYears={years}
                />
              </div>
            )}

            {/* Sensitivity */}
            {dcfResult && !dcfResult.error && stockData && (
              <div style={{ marginBottom: 14 }}>
                <SensitivityTable
                  fcf={fcf}
                  sharesOutstanding={sharesOutstanding}
                  terminalGrowth={terminalGrowth}
                  years={years}
                  wacc={wacc}
                  growthRate={growthRate}
                  currency={currency}
                  transitionYears={transitionYears}
                  totalCash={totalCash}
                  totalDebt={totalDebt}
                />
              </div>
            )}

            {/* Peers */}
            {peersLoading && (
              <div className="dcf-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text3)", marginBottom: 14 }}>
                <Loader2 className="animate-spin" />
                <span style={{ fontSize: 12 }}>Identifying and fetching industry peers...</span>
              </div>
            )}
            {peers.length > 0 && !peersLoading && stockData && (
              <div style={{ marginBottom: 14 }}>
                <PeerComparisonTable mainTicker={stockData.symbol} peers={peers} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── FLOATING CHAT FAB + DRAWER ── */}
      <div className={`chat-drawer ${chatOpen ? "open" : ""}`}>
        <div className="chat-drawer-header">
          <div className="chat-drawer-title">
            <MessageSquare />
            AI Chatbot
            <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", marginLeft: 4 }}>
              {aiLoading ? "Thinking..." : "Powered by Gemini"}
            </span>
          </div>
          <button className="chat-close-btn" onClick={() => setChatOpen(false)} title="Close">
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>
        <div ref={chatScrollRef} className="chat-messages dcf-scroll">
          {messages.map((msg, idx) => (
            <div key={idx} className={`msg-row ${msg.role}`}>
              <div className="msg-bubble">{msg.content}</div>
            </div>
          ))}
          {aiLoading && (
            <div className="msg-row assistant">
              <div className="msg-bubble" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text3)" }}>
                <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} />
                Thinking...
              </div>
            </div>
          )}
        </div>
        <div className="chat-input-row">
          <input
            type="text"
            className="chat-input"
            placeholder="Ask Gemini about this stock..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && chatInput && handleGeminiChat(chatInput, "chat")}
          />
          <button
            className="chat-send"
            onClick={() => handleGeminiChat(chatInput, "chat")}
            disabled={aiLoading || !chatInput}
          >
            <Send style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      <button
        className="chat-fab"
        onClick={() => setChatOpen((o) => !o)}
        title={chatOpen ? "Close chat" : "Open AI chat"}
      >
        {chatOpen ? <X /> : <MessageSquare />}
        {!chatOpen && unreadCount > 0 && (
          <span className="chat-fab-badge">{unreadCount}</span>
        )}
      </button>

      {/* ── TOAST ── */}
      <div className={`share-toast ${toast ? "visible" : ""}`}>
        {toast}
      </div>
    </div>
  );
}
