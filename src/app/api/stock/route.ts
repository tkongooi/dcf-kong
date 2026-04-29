import YahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';

const yahooFinance = new YahooFinance();

const TICKER_RE = /^[A-Z0-9.\-=^]{1,32}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('ticker');

  if (!raw) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
  }
  const tickerParam = raw.trim().toUpperCase();
  if (!TICKER_RE.test(tickerParam)) {
    return NextResponse.json({ error: 'Invalid ticker format' }, { status: 400 });
  }

  try {
    let quote;
    try {
      quote = await yahooFinance.quote(tickerParam);
    } catch (e) {
      const searchRes = await yahooFinance.search(tickerParam);
      const bestMatch = searchRes.quotes.find(
        (q) => (q as { quoteType?: string }).quoteType === 'EQUITY'
      ) as { symbol?: string } | undefined;
      if (bestMatch && typeof bestMatch.symbol === 'string') {
        quote = await yahooFinance.quote(bestMatch.symbol);
      } else {
        throw e;
      }
    }

    const ticker = quote.symbol;

    const [summaryRes, chartRes] = await Promise.all([
      yahooFinance.quoteSummary(ticker, {
        modules: [
          'summaryProfile',
          'cashflowStatementHistory',
          'cashflowStatementHistoryQuarterly',
          'incomeStatementHistory',
          'incomeStatementHistoryQuarterly',
          'summaryDetail',
          'defaultKeyStatistics',
          'financialData',
        ],
      }),
      yahooFinance.chart(ticker, {
        period1: new Date(new Date().setFullYear(new Date().getFullYear() - 5)),
        interval: '1mo',
      }),
    ]);

    const stats = summaryRes.defaultKeyStatistics;
    const finData = summaryRes.financialData;

    let cashFlowModule = summaryRes.cashflowStatementHistory;
    let isQuarterly = false;

    if (!cashFlowModule?.cashflowStatements?.length) {
      cashFlowModule = summaryRes.cashflowStatementHistoryQuarterly;
      isQuarterly = true;
    }

    const getVal = (obj: Record<string, unknown> | null | undefined, patterns: string[]): number => {
      if (!obj) return 0;
      const keys = Object.keys(obj);
      for (const pattern of patterns) {
        const foundKey = keys.find(k => k.toLowerCase().includes(pattern.toLowerCase()));
        if (!foundKey) continue;
        const raw = obj[foundKey];
        if (raw && typeof raw === 'object' && 'raw' in raw && typeof (raw as { raw: unknown }).raw === 'number') {
          return (raw as { raw: number }).raw;
        }
        if (typeof raw === 'number') return raw;
      }
      return 0;
    };

    const ocfPatterns = ['totalCashFromOperating', 'operatingCashflow', 'cashFromOperating', 'netCashProvidedByOperating'];
    const capexPatterns = ['capitalExpenditure', 'capex', 'additionsToPropertyPlantAndEquipment'];

    // Yahoo reports capex as a negative number, so FCF = OCF + capex.
    const historicalFCF = (cashFlowModule?.cashflowStatements || []).slice(0, 5).map((stmt) => {
      const stmtRecord = stmt as unknown as Record<string, unknown>;
      const ocf = getVal(stmtRecord, ocfPatterns);
      const capex = getVal(stmtRecord, capexPatterns);
      const endDate = stmtRecord.endDate;
      return {
        date: endDate instanceof Date ? endDate.toISOString().split('T')[0] : 'N/A',
        fcf: (ocf + capex) / 1e9,
        ocf: ocf / 1e9,
        capex: capex / 1e9,
        isQuarterly,
      };
    }).filter((item) => item.date !== 'N/A' && (item.ocf !== 0 || item.capex !== 0));

    let currentFCF: number | null = null;
    if (historicalFCF.length > 0) {
      currentFCF = historicalFCF[0].fcf;
    } else if (finData?.freeCashflow) {
      currentFCF = finData.freeCashflow / 1e9;
    } else if (finData?.operatingCashflow) {
      currentFCF = (finData.operatingCashflow * 0.9) / 1e9;
    }

    const history = (chartRes.quotes || [])
      .filter((q) => q?.date instanceof Date && q.close != null)
      .map((q) => ({
        date: (q.date as Date).toISOString().split('T')[0],
        price: q.close as number,
      }));

    const data: Record<string, unknown> = {
      symbol: quote.symbol,
      price: quote.regularMarketPrice,
      currency: quote.currency,
      shortName: quote.shortName,
      sharesOutstanding: quote.sharesOutstanding ? quote.sharesOutstanding / 1e9 : (stats?.sharesOutstanding ? stats.sharesOutstanding / 1e9 : null),
      marketCap: quote.marketCap ? quote.marketCap / 1e9 : null,
      peRatio: quote.trailingPE || summaryRes.summaryDetail?.trailingPE || null,
      forwardPE: quote.forwardPE || summaryRes.summaryDetail?.forwardPE || null,
      priceToBook: summaryRes.summaryDetail?.priceToBook || stats?.priceToBook || null,
      priceToSales: summaryRes.summaryDetail?.priceToSalesTrailing12Months || quote.priceToSales || null,
      dividendYield: summaryRes.summaryDetail?.dividendYield ? summaryRes.summaryDetail.dividendYield * 100 : (quote.dividendYield || null),
      beta: summaryRes.summaryDetail?.beta || stats?.beta || null,
      totalCash: finData?.totalCash ? finData.totalCash / 1e9 : (stats?.totalCash ? (stats.totalCash as number) / 1e9 : 0),
      totalDebt: finData?.totalDebt ? finData.totalDebt / 1e9 : (stats?.totalDebt ? (stats.totalDebt as number) / 1e9 : 0),
      returnOnEquity: finData?.returnOnEquity ? (finData.returnOnEquity as number) * 100 : (stats?.returnOnEquity ? (stats.returnOnEquity as number) * 100 : null),
      returnOnAssets: finData?.returnOnAssets ? (finData.returnOnAssets as number) * 100 : (stats?.returnOnAssets ? (stats.returnOnAssets as number) * 100 : null),
      debtToEquity: finData?.debtToEquity || stats?.debtToEquity || null,
      currentRatio: finData?.currentRatio || stats?.currentRatio || null,
      operatingMargins: finData?.operatingMargins ? (finData.operatingMargins as number) * 100 : (stats?.operatingMargins ? (stats.operatingMargins as number) * 100 : null),
      freeCashFlow: currentFCF,
      historicalFCF,
      sector: summaryRes.summaryProfile?.sector,
      industry: summaryRes.summaryProfile?.industry,
      history,
    };

    if (process.env.NODE_ENV !== 'production') {
      data.debug = {
        hasCashFlowYearly: !!summaryRes.cashflowStatementHistory?.cashflowStatements?.length,
        hasCashFlowQuarterly: !!summaryRes.cashflowStatementHistoryQuarterly?.cashflowStatements?.length,
        hasFinData: !!summaryRes.financialData,
        availableModules: Object.keys(summaryRes),
      };
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Yahoo Finance Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stock data', details: errorMessage }, { status: 500 });
  }
}
