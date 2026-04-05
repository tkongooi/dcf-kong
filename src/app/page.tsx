"use client";

import React, { useState, useEffect, useRef } from "react";
import * as Slider from "@radix-ui/react-slider";
import { Search, Info, TrendingUp, AlertCircle, MessageSquare, Loader2, Download, Zap, MinusCircle, PlusCircle, Save, History, Trash2, ShieldAlert, BarChart3, Users } from "lucide-react";
import { calculateDCF } from "@/lib/dcf";
import { SensitivityTable } from "@/components/SensitivityTable";
import { StockPriceChart } from "@/components/StockPriceChart";
import { HistoricalFCFChart } from "@/components/HistoricalFCFChart";
import { PeerComparisonTable } from "@/components/PeerComparisonTable";
import { AuthUI } from "@/components/Auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
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
  freeCashFlow: number | null;
  historicalFCF: { date: string; fcf: number; ocf?: number; capex?: number }[];
  sector?: string;
  industry?: string;
  history: { date: string; price: number }[];
}

interface DCFResult {
  enterpriseValue: number;
  equityValue: number;
  netDebt: number;
  valuePerShare: number;
  projectedFCF: number[];
  annualGrowthRates: number[];
  terminalValue: number;
  presentValue: number;
  presentTerminalValue: number;
}

export default function Home() {
  const [ticker, setTicker] = useState("");
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  // DCF Parameters
  const [fcf, setFcf] = useState(0);
  const [wacc, setWacc] = useState(10);
  const [growthRate, setGrowthRate] = useState(5);
  const [terminalGrowth, setTerminalGrowth] = useState(2);
  const [years, setYears] = useState(5);
  const [sharesOutstanding, setSharesOutstanding] = useState(0);
  const [transitionYears, setTransitionYears] = useState(5);
  const [totalCash, setTotalCash] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);

  // Peer State
  const [peers, setPeers] = useState<any[]>([]);
  const [peersLoading, setPeersLoading] = useState(false);

  // Scenario Base Values
  const [baseParams, setBaseParams] = useState({ wacc: 10, growthRate: 5 });

  const [dcfResult, setDcfResult] = useState<DCFResult | null>(null);

  // Auth & Saved Data
  const [user, setUser] = useState<any>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<any[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);

  // AI State
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "Hello! Search for a stock ticker to start our analysis. I can help you research initial DCF parameters and discuss the company's fundamentals." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isSupabaseConfigured) {
      supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
      supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    }
  }, []);

  useEffect(() => {
    if (user && isSupabaseConfigured) fetchSavedAnalyses();
    else setSavedAnalyses([]);
  }, [user]);

  const fetchSavedAnalyses = async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (data) setSavedAnalyses(data);
    if (error) console.error("Error fetching saved analyses:", error);
  };

  const saveAnalysis = async () => {
    if (!isSupabaseConfigured) return alert("Database not configured. Set Supabase keys in .env.local");
    if (!user) return alert("Please login to save your analysis!");
    if (!ticker) return;

    setSaveLoading(true);
    const { error } = await supabase.from("analyses").insert({
      user_id: user.id,
      ticker,
      fcf,
      wacc,
      growth_rate: growthRate,
      terminal_growth: terminalGrowth,
      years,
      shares: sharesOutstanding,
    });

    if (error) alert(error.message);
    else {
      fetchSavedAnalyses();
      alert("Analysis saved successfully!");
    }
    setSaveLoading(false);
  };

  const loadAnalysis = (item: any) => {
    setTicker(item.ticker);
    setFcf(item.fcf);
    setWacc(item.wacc);
    setGrowthRate(item.growth_rate);
    setTerminalGrowth(item.terminal_growth);
    setYears(item.years);
    setSharesOutstanding(item.shares);
    fetchStockData(item.ticker, true);
  };

  const deleteAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from("analyses").delete().eq("id", id);
    if (!error) fetchSavedAnalyses();
  };

  const setScenario = (type: "bear" | "base" | "bull") => {
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
        backgroundColor: "#ffffff",
        style: { background: "white" }
      });
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${ticker || "stock"}-dcf-analysis.pdf`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "PDF generation failed";
      setError(`Failed to generate PDF: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchStockData = async (activeTickerParam?: string, skipAi?: boolean) => {
    let activeTicker = (activeTickerParam || ticker).trim();
    if (!activeTicker) return;
    
    setLoading(true);
    setError("");
    setPeers([]);

    try {
      // 1. Try direct fetch first (standard ticker path)
      let res = await fetch(`/api/stock?ticker=${activeTicker}`);
      let data = await res.json();

      // 2. If direct fetch fails, try to resolve via AI
      if (data.error) {
        const resolution = await handleGeminiChat(activeTicker, "resolve-ticker");
        
        if (resolution && resolution.ticker && resolution.confidence === "high") {
          activeTicker = resolution.ticker;
          setTicker(activeTicker); 
          
          res = await fetch(`/api/stock?ticker=${activeTicker}`);
          data = await res.json();
          if (data.error) throw new Error(data.error);
        } else if (resolution && resolution.suggestions && resolution.suggestions.length > 0) {
          const suggestionList = resolution.suggestions.map((s: string) => `'${s}'`).join(" or ");
          throw new Error(`Could not find an exact match for "${activeTicker}". Try searching for: ${suggestionList}`);
        } else {
          throw new Error(`Could not find a stock ticker for "${activeTicker}".`);
        }
      }
      
      setStockData(data);
      
      // Update parameters
      if (data.freeCashFlow !== null && data.freeCashFlow !== undefined) {
        setFcf(data.freeCashFlow);
      }
      if (data.sharesOutstanding) {
        setSharesOutstanding(data.sharesOutstanding);
      }
      if (data.totalCash !== undefined) setTotalCash(data.totalCash);
      if (data.totalDebt !== undefined) setTotalDebt(data.totalDebt);

      if (!skipAi) {
        // Reduced to a single all-in-one AI call
        handleGeminiChat(`Comprehensive research for ${data.symbol}`, "all-in-one", data.symbol);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGeminiChat = async (input: string, type: "chat" | "research" | "commentary" | "combined" | "peers" | "resolve-ticker" | "all-in-one" = "chat", overrideTicker?: string) => {
    const currentTicker = overrideTicker || ticker;
    if (!currentTicker && type !== "chat") return;
    
    if (type === "chat") {
      setMessages(prev => [...prev, { role: "user", content: input }]);
    }
    
    if (type === "peers" || type === "resolve-ticker" || type === "all-in-one") setPeersLoading(true);
    else setAiLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ticker: currentTicker, 
          type, 
          context: input,
          history: messages 
        }),
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      if (type === "all-in-one") {
        try {
          const jsonMatch = data.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const allData = JSON.parse(jsonMatch[0]);
            
            // 1. Handle DCF Parameters
            if (allData.dcf) {
              const params = allData.dcf;
              if (params.fcf) setFcf(params.fcf);
              if (params.wacc) {
                setWacc(params.wacc);
                setBaseParams(prev => ({ ...prev, wacc: params.wacc }));
              }
              if (params.growthRate) {
                setGrowthRate(params.growthRate);
                setBaseParams(prev => ({ ...prev, growthRate: params.growthRate }));
              }
              if (params.terminalGrowth) setTerminalGrowth(params.terminalGrowth);
              if (params.years) setYears(params.years);
              if (params.transitionYears) setTransitionYears(params.transitionYears);
              
              if (params.historicalFCF && params.historicalFCF.length > 0) {
                setStockData(prev => {
                  if (!prev) return null;
                  if (!prev.historicalFCF || prev.historicalFCF.length === 0) {
                    return { ...prev, historicalFCF: params.historicalFCF };
                  }
                  return prev;
                });
              }
            }

            // 2. Handle Peers
            if (allData.peers && Array.isArray(allData.peers)) {
              const tickersToFetch = Array.from(new Set([currentTicker, ...allData.peers])).join(",");
              const peersRes = await fetch(`/api/stocks?tickers=${tickersToFetch}`);
              const peersData = await peersRes.json();
              setPeers(peersData);
            }

            // 3. Handle Analysis/Chat
            if (allData.analysis) {
              setMessages(prev => [...prev, { role: "assistant", content: allData.analysis }]);
            } else {
              // Fallback to full text if structured analysis missing
              setMessages(prev => [...prev, { role: "assistant", content: data.text }]);
            }
          }
        } catch (e) {
          console.error("Failed to parse all-in-one data", e);
        }
      }

      if (type === "resolve-ticker") {
        try {
          const jsonMatch = data.text.match(/\{[\s\S]*\}/);
          const resolution = JSON.parse(jsonMatch ? jsonMatch[0] : data.text);
          return resolution;
        } catch (e) {
          console.error("Failed to parse resolution", e);
          return null;
        }
      }

      if (type === "peers") {
        try {
          const peerTickers = JSON.parse(data.text);
          if (Array.isArray(peerTickers)) {
            // Fetch metrics for peers + main stock
            const tickersToFetch = Array.from(new Set([currentTicker, ...peerTickers])).join(",");
            const peersRes = await fetch(`/api/stocks?tickers=${tickersToFetch}`);
            const peersData = await peersRes.json();
            setPeers(peersData);
          }
        } catch (e) {
          console.error("Failed to parse or fetch peers", e);
        }
      }

      if (type === "combined" || type === "research") {
        const jsonMatch = data.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const params = JSON.parse(jsonMatch[0]);
            if (params.fcf) setFcf(params.fcf);
            if (params.wacc) {
              setWacc(params.wacc);
              setBaseParams(prev => ({ ...prev, wacc: params.wacc }));
            }
            if (params.growthRate) {
              setGrowthRate(params.growthRate);
              setBaseParams(prev => ({ ...prev, growthRate: params.growthRate }));
            }
            if (params.terminalGrowth) setTerminalGrowth(params.terminalGrowth);
            if (params.years) setYears(params.years);
            
            // AI DATA RECOVERY: If Yahoo failed to provide historical FCF, use AI data
            if (params.historicalFCF && params.historicalFCF.length > 0) {
              setStockData(prev => {
                if (!prev) return null;
                // Only use AI data if Yahoo data is empty
                if (!prev.historicalFCF || prev.historicalFCF.length === 0) {
                  return { ...prev, historicalFCF: params.historicalFCF };
                }
                return prev;
              });
            }
          } catch (e) {
            console.error("Failed to parse AI parameters", e);
          }
        }
      }

      setMessages(prev => [...prev, { role: "assistant", content: data.text }]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${errorMessage}. Please ensure GEMINI_API_KEY is set in your environment.` }]);
    } finally {
      setAiLoading(false);
      setPeersLoading(false);
      setChatInput("");
    }
  };

  useEffect(() => {
    if (fcf !== 0 && sharesOutstanding > 0) {
      const result = calculateDCF(fcf, growthRate, terminalGrowth, wacc, years, sharesOutstanding, transitionYears, totalCash, totalDebt);
      setDcfResult(result);
    }
  }, [fcf, growthRate, terminalGrowth, wacc, years, sharesOutstanding, transitionYears, totalCash, totalDebt]);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="font-medium">Initializing DCF Dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      {!isSupabaseConfigured && (
        <div className="max-w-6xl mx-auto mb-6">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <div className="text-sm">
              <span className="font-bold">Database & Auth disabled:</span> Please add <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your <code className="bg-amber-100 px-1 rounded">.env.local</code> file to enable saving features.
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">DCF Analysis Tool</h1>
            <p className="text-slate-500">
              Intrinsic value estimation for global stocks, created by <span className="font-semibold text-slate-700">Kong Ooi Tan</span>
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
            {aiLoading && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold animate-pulse border border-blue-100 shadow-sm whitespace-nowrap">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                Gemini is researching...
              </div>
            )}
            <AuthUI />
            <div className="flex gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ticker (e.g. AAPL, 0700.HK)"
                  className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64 transition-all"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && fetchStockData()}
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              </div>
              <button
                onClick={() => fetchStockData()}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
              >
                {loading ? "..." : "Fetch"}
              </button>
              <button
                onClick={downloadPDF}
                disabled={!dcfResult || loading}
                className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-slate-600 transition-colors"
                title="Download Report as PDF"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Parameters
                </h2>
                {isSupabaseConfigured && user && ticker && (
                  <button 
                    onClick={saveAnalysis}
                    disabled={saveLoading}
                    className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    {saveLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Save
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 pb-2">
                <button onClick={() => setScenario("bear")} className="flex flex-col items-center gap-1 p-2 rounded-lg border border-red-100 bg-red-50/30 hover:bg-red-50 text-red-700 transition-all">
                  <MinusCircle className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase">Bear</span>
                </button>
                <button onClick={() => setScenario("base")} className="flex flex-col items-center gap-1 p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all">
                  <Zap className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase">Base</span>
                </button>
                <button onClick={() => setScenario("bull")} className="flex flex-col items-center gap-1 p-2 rounded-lg border border-green-100 bg-green-50/30 hover:bg-green-50 text-green-700 transition-all">
                  <PlusCircle className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase">Bull</span>
                </button>
              </div>
              <hr className="border-slate-100" />
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Initial FCF (Billion $)</label>
                  <input type="number" step="0.01" value={fcf} onChange={(e) => setFcf(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Shares Outstanding (Billion)</label>
                  <input type="number" step="0.01" value={sharesOutstanding} onChange={(e) => setSharesOutstanding(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Total Cash (B)</label>
                    <input type="number" step="0.1" value={totalCash} onChange={(e) => setTotalCash(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Total Debt (B)</label>
                    <input type="number" step="0.1" value={totalDebt} onChange={(e) => setTotalDebt(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                  </div>
                </div>
                {dcfResult && (
                  <div className="pt-2">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Equity Value</span>
                        <span title="Equity Value = Enterprise Value + Cash - Debt">
                          <Info className="h-3 w-3 text-slate-400 cursor-help" />
                        </span>
                      </div>
                      <p className="text-xl font-bold text-slate-900">
                        {stockData?.currency || "$"}{dcfResult.equityValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}B
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <hr className="border-slate-100" />
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-700">WACC (%)</label>
                    <span className="text-sm font-bold text-blue-600">{wacc}%</span>
                  </div>
                  <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[wacc]} max={20} min={1} step={0.1} onValueChange={(vals) => setWacc(vals[0])}>
                    <Slider.Track className="bg-slate-200 relative grow rounded-full h-[4px]"><Slider.Range className="absolute bg-blue-500 rounded-full h-full" /></Slider.Track>
                    <Slider.Thumb className="block w-5 h-5 bg-white shadow-lg border border-slate-200 rounded-full hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </Slider.Root>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-700">Growth Rate (%)</label>
                    <span className="text-sm font-bold text-blue-600">{growthRate}%</span>
                  </div>
                  <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[growthRate]} max={50} min={-20} step={0.5} onValueChange={(vals) => setGrowthRate(vals[0])}>
                    <Slider.Track className="bg-slate-200 relative grow rounded-full h-[4px]"><Slider.Range className="absolute bg-blue-500 rounded-full h-full" /></Slider.Track>
                    <Slider.Thumb className="block w-5 h-5 bg-white shadow-lg border border-slate-200 rounded-full hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </Slider.Root>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-700">Terminal Growth (%)</label>
                    <span className="text-sm font-bold text-blue-600">{terminalGrowth}%</span>
                  </div>
                  <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[terminalGrowth]} max={10} min={0} step={0.1} onValueChange={(vals) => setTerminalGrowth(vals[0])}>
                    <Slider.Track className="bg-slate-200 relative grow rounded-full h-[4px]"><Slider.Range className="absolute bg-blue-500 rounded-full h-full" /></Slider.Track>
                    <Slider.Thumb className="block w-5 h-5 bg-white shadow-lg border border-slate-200 rounded-full hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </Slider.Root>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-700">Initial Period (Years)</label>
                    <span className="text-sm font-bold text-blue-600">{years}</span>
                  </div>
                  <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[years]} max={20} min={1} step={1} onValueChange={(vals) => setYears(vals[0])}>
                    <Slider.Track className="bg-slate-200 relative grow rounded-full h-[4px]"><Slider.Range className="absolute bg-blue-500 rounded-full h-full" /></Slider.Track>
                    <Slider.Thumb className="block w-5 h-5 bg-white shadow-lg border border-slate-200 rounded-full hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </Slider.Root>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-700">Transition Period (Years)</label>
                    <span className="text-sm font-bold text-blue-600">{transitionYears}</span>
                  </div>
                  <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[transitionYears]} max={10} min={0} step={1} onValueChange={(vals) => setTransitionYears(vals[0])}>
                    <Slider.Track className="bg-slate-200 relative grow rounded-full h-[4px]"><Slider.Range className="absolute bg-blue-500 rounded-full h-full" /></Slider.Track>
                    <Slider.Thumb className="block w-5 h-5 bg-white shadow-lg border border-slate-200 rounded-full hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </Slider.Root>
                </div>
              </div>
              <div className="pt-4">
                <button onClick={() => handleGeminiChat(`Suggest DCF parameters for ${ticker}`, "research")} disabled={aiLoading || !ticker} className="w-full py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 font-medium flex items-center justify-center gap-2 transition-all text-sm">
                  <Info className="h-4 w-4" /> {aiLoading ? "Researching..." : "AI Research Assistant"}
                </button>
              </div>
            </section>

            {user && savedAnalyses.length > 0 && (
              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <History className="h-4 w-4" />
                  My Analyses
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {savedAnalyses.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => loadAnalysis(item)}
                      className="p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-all group"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-900">{item.ticker}</p>
                          <p className="text-[10px] text-slate-500">{new Date(item.created_at).toLocaleDateString()}</p>
                        </div>
                        <button 
                          onClick={(e) => deleteAnalysis(item.id, e)}
                          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-md transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">WACC: {item.wacc}%</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">G: {item.growth_rate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div ref={reportRef} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm font-medium text-slate-500 mb-1">Equity Value (per Share)</p>
                  <h3 className="text-4xl font-bold text-slate-900">{stockData?.currency || "$"} {dcfResult ? dcfResult.valuePerShare.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "---"}</h3>
                  {stockData && dcfResult && stockData.price && (
                    <div className="mt-2">
                      <span className={`text-sm font-bold ${dcfResult.valuePerShare > stockData.price ? 'text-green-600' : 'text-red-600'}`}>
                        {((dcfResult.valuePerShare / stockData.price - 1) * 100).toFixed(1)}% {dcfResult.valuePerShare > stockData.price ? 'Upside' : 'Downside'}
                      </span>
                      <span className="text-sm text-slate-500 ml-2">from current {stockData.price}</span>
                    </div>
                  )}
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm font-medium text-slate-500 mb-1">Company Info</p>
                  <h3 className="text-2xl font-bold text-slate-900 truncate">
                    {stockData ? `${stockData.shortName} (${stockData.symbol})` : "No Data"}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">{stockData?.sector ? `${stockData.sector} • ${stockData.industry}` : "Search a ticker to get started"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">P/E</p>
                  <p className="text-lg font-bold text-slate-800">{stockData?.peRatio ? Number(stockData.peRatio).toFixed(1) : "---"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Fwd P/E</p>
                  <p className="text-lg font-bold text-slate-800">{stockData?.forwardPE ? Number(stockData.forwardPE).toFixed(1) : "---"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">P/B</p>
                  <p className="text-lg font-bold text-slate-800">{stockData?.priceToBook ? Number(stockData.priceToBook).toFixed(1) : "---"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">P/S</p>
                  <p className="text-lg font-bold text-slate-800">{stockData?.priceToSales ? Number(stockData.priceToSales).toFixed(1) : "---"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Mkt Cap</p>
                  <p className="text-lg font-bold text-slate-800">{stockData?.marketCap ? `${Number(stockData.marketCap).toFixed(1)}B` : "---"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Div. Yield</p>
                  <p className="text-lg font-bold text-slate-800">{stockData?.dividendYield ? `${Number(stockData.dividendYield).toFixed(1)}%` : "---"}</p>
                </div>
              </div>

              {stockData?.history && dcfResult && (
                <StockPriceChart 
                  history={stockData.history} 
                  intrinsicValue={dcfResult.valuePerShare} 
                  ticker={stockData.symbol} 
                />
              )}

              <div className="space-y-4">
                {stockData?.historicalFCF && stockData.historicalFCF.length > 0 ? (
                  <div className="space-y-6">
                    <HistoricalFCFChart 
                      data={stockData.historicalFCF} 
                      projections={dcfResult?.projectedFCF} 
                      growthRates={dcfResult?.annualGrowthRates}
                      initialYears={years}
                    />
                    
                    {dcfResult && (
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                        <h3 className="text-lg font-semibold mb-4 text-slate-900">3-Stage Growth Summary</h3>
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="p-3 text-left border-b font-medium text-slate-500">Stage</th>
                              <th className="p-3 text-left border-b font-medium text-slate-500">Duration</th>
                              <th className="p-3 text-left border-b font-medium text-slate-500">Avg. Growth</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="p-3 border-b font-bold text-slate-800 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#8b5cf6]"></div> Initial Period
                              </td>
                              <td className="p-3 border-b text-slate-600">{years} Years</td>
                              <td className="p-3 border-b text-slate-600 font-semibold">{growthRate.toFixed(1)}%</td>
                            </tr>
                            <tr>
                              <td className="p-3 border-b font-bold text-slate-800 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#d946ef]"></div> Transition Period
                              </td>
                              <td className="p-3 border-b text-slate-600">{transitionYears} Years</td>
                              <td className="p-3 border-b text-slate-600 font-semibold">
                                {transitionYears > 0 
                                  ? ((growthRate + terminalGrowth) / 2).toFixed(1) 
                                  : "---"}% (Declining)
                              </td>
                            </tr>
                            <tr className="bg-blue-50/20">
                              <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#2563eb]"></div> Terminal Period
                              </td>
                              <td className="p-3 text-slate-600">Perpetuity</td>
                              <td className="p-3 text-slate-600 font-semibold">{terminalGrowth.toFixed(1)}%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : stockData ? (
                  <div className="bg-white p-8 rounded-xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-400 gap-2">
                    <BarChart3 className="h-8 w-8 opacity-20" />
                    <p className="text-sm font-medium">No Historical FCF Data found on Yahoo Finance</p>
                    <p className="text-[10px] text-blue-500 font-bold uppercase tracking-tight">AI Assistant is researching historical data as fallback...</p>
                  </div>
                ) : null}
              </div>

              {dcfResult && stockData && (
                <SensitivityTable fcf={fcf} sharesOutstanding={sharesOutstanding} terminalGrowth={terminalGrowth} years={years} wacc={wacc} growthRate={growthRate} currency={stockData.currency || "$"} />
              )}

              {peersLoading && (
                <div className="bg-white p-8 rounded-xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin opacity-20" />
                  <p className="text-sm font-medium">Identifying and fetching industry peers...</p>
                </div>
              )}

              {peers.length > 0 && !peersLoading && (
                <PeerComparisonTable mainTicker={stockData?.symbol || ""} peers={peers} />
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[500px]">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="h-5 w-5 text-blue-600" /> AI Chatbot</h3>
                  <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-600 rounded-full">{aiLoading ? "Thinking..." : "AI Assistant"}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] p-3 rounded-lg text-sm shadow-sm ${msg.role === "user" ? "bg-blue-600 text-white rounded-br-none" : "bg-white border border-slate-100 text-slate-700 rounded-bl-none"}`}>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-slate-100 bg-white rounded-b-xl">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Ask Gemini about this stock..." className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && chatInput && handleGeminiChat(chatInput, "chat")} />
                    <button onClick={() => handleGeminiChat(chatInput, "chat")} disabled={aiLoading || !chatInput} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium text-sm disabled:opacity-50 hover:bg-slate-800">Send</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
