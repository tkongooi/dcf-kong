"use client";

import React, { useState, useEffect, useRef } from "react";
import * as Slider from "@radix-ui/react-slider";
import { Search, Info, TrendingUp, AlertCircle, MessageSquare, Loader2, Download, Zap, MinusCircle, PlusCircle, Brain, Sparkles } from "lucide-react";
import { calculateDCF } from "@/lib/dcf";
import { SensitivityTable } from "@/components/SensitivityTable";
import { StockPriceChart } from "@/components/StockPriceChart";
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
  freeCashFlow: number | null;
  sector?: string;
  industry?: string;
  history: { date: string; price: number }[];
}

interface DCFResult {
  enterpriseValue: number;
  valuePerShare: number;
  projectedFCF: number[];
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

  // Scenario Base Values
  const [baseParams, setBaseParams] = useState({ wacc: 10, growthRate: 5 });

  const [dcfResult, setDcfResult] = useState<DCFResult | null>(null);

  // AI State
  const [aiModel, setAiModel] = useState<"flash" | "pro">("flash");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "Hello! Search for a stock ticker to start our analysis. I can help you research initial DCF parameters and discuss the company's fundamentals." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const fetchStockData = async () => {
    if (!ticker) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/stock?ticker=${ticker}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setStockData(data);
      if (data.freeCashFlow) setFcf(data.freeCashFlow);
      if (data.sharesOutstanding) setSharesOutstanding(data.sharesOutstanding);
      
      handleGeminiChat(`Analyze ${data.symbol} for DCF and suggest parameters.`, "combined", data.symbol);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGeminiChat = async (input: string, type: "chat" | "research" | "commentary" | "combined" = "chat", overrideTicker?: string) => {
    const currentTicker = overrideTicker || ticker;
    if (!currentTicker && type !== "chat") return;
    
    if (type === "chat") {
      setMessages(prev => [...prev, { role: "user", content: input }]);
    }
    
    setAiLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ticker: currentTicker, 
          type, 
          context: input,
          history: messages,
          model: aiModel
        }),
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

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
      setChatInput("");
    }
  };

  useEffect(() => {
    if (fcf > 0 && sharesOutstanding > 0) {
      const result = calculateDCF(fcf, growthRate, terminalGrowth, wacc, years, sharesOutstanding);
      setDcfResult(result);
    }
  }, [fcf, growthRate, terminalGrowth, wacc, years, sharesOutstanding]);

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
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">DCF Analysis Tool</h1>
            <p className="text-slate-500">Intrinsic value estimation for global stocks</p>
          </div>
          <div className="flex flex-col md:flex-row items-end md:items-center gap-3">
            {aiLoading && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold animate-pulse border border-blue-100 shadow-sm whitespace-nowrap">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                Gemini is researching...
              </div>
            )}
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
                onClick={fetchStockData}
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

        <div ref={reportRef} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Parameters
                  </h2>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button 
                      onClick={() => setAiModel("flash")}
                      className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${aiModel === "flash" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      FLASH
                    </button>
                    <button 
                      onClick={() => setAiModel("pro")}
                      className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${aiModel === "pro" ? "bg-white text-purple-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      PRO
                    </button>
                  </div>
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
                      <label className="text-sm font-medium text-slate-700">Projection Period (Years)</label>
                      <span className="text-sm font-bold text-blue-600">{years}</span>
                    </div>
                    <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[years]} max={20} min={1} step={1} onValueChange={(vals) => setYears(vals[0])}>
                      <Slider.Track className="bg-slate-200 relative grow rounded-full h-[4px]"><Slider.Range className="absolute bg-blue-500 rounded-full h-full" /></Slider.Track>
                      <Slider.Thumb className="block w-5 h-5 bg-white shadow-lg border border-slate-200 rounded-full hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </Slider.Root>
                  </div>
                </div>
                <div className="pt-4">
                  <button 
                    onClick={() => handleGeminiChat(`Suggest DCF parameters for ${ticker}`, "research")} 
                    disabled={aiLoading || !ticker} 
                    className={`w-full py-3 text-white rounded-lg disabled:opacity-50 font-medium flex items-center justify-center gap-2 transition-all text-sm ${aiModel === "pro" ? "bg-purple-600 hover:bg-purple-700" : "bg-slate-900 hover:bg-slate-800"}`}
                  >
                    {aiModel === "pro" ? <Brain className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    {aiLoading ? "Gemini is thinking..." : `AI Research Assistant (${aiModel.toUpperCase()})`}
                  </button>
                </div>
              </div>
            </section>

            <section className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm font-medium text-slate-500 mb-1">Intrinsic Value (Fair Price)</p>
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
                  <h3 className="text-2xl font-bold text-slate-900 truncate">{stockData ? stockData.shortName : "No Data"}</h3>
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

              {dcfResult && stockData && (
                <SensitivityTable fcf={fcf} sharesOutstanding={sharesOutstanding} terminalGrowth={terminalGrowth} years={years} wacc={wacc} growthRate={growthRate} currency={stockData.currency || "$"} />
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[500px]">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600" /> 
                    Gemini Analysis
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${aiModel === "pro" ? "bg-purple-50 text-purple-600 border-purple-100" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
                      {aiModel.toUpperCase()}
                    </span>
                    <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded-full">{aiLoading ? "Thinking..." : "AI Assistant"}</span>
                  </div>
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
                    <input type="text" placeholder={`Ask Gemini ${aiModel.toUpperCase()}...`} className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && chatInput && handleGeminiChat(chatInput, "chat")} />
                    <button onClick={() => handleGeminiChat(chatInput, "chat")} disabled={aiLoading || !chatInput} className={`px-4 py-2 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors ${aiModel === "pro" ? "bg-purple-600 hover:bg-purple-700" : "bg-slate-900 hover:bg-slate-800"}`}>Send</button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
