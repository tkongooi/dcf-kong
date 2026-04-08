import YahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';

const yahooFinance = new YahooFinance();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickerParam = searchParams.get('ticker');

  if (!tickerParam) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
  }

  try {
    let quote;
    try {
      quote = await yahooFinance.quote(tickerParam);
    } catch (e) {
      const searchRes = await yahooFinance.search(tickerParam);
      const bestMatch = searchRes.quotes.find((q: any) => q.quoteType === 'EQUITY');
      if (bestMatch && typeof bestMatch.symbol === 'string') {
        quote = await yahooFinance.quote(bestMatch.symbol);
      } else {
        throw e;
      }
    }

    const ticker = quote.symbol;
    
    // Exhaustive list of modules to find ANY financial data
    const summaryRes = await yahooFinance.quoteSummary(ticker, { 
      modules: [
        'summaryProfile', 
        'cashflowStatementHistory', 
        'cashflowStatementHistoryQuarterly', 
        'incomeStatementHistory',
        'incomeStatementHistoryQuarterly',
        'summaryDetail', 
        'defaultKeyStatistics',
        'financialData'
      ] 
    });

    const stats = summaryRes.defaultKeyStatistics;
    const finData = summaryRes.financialData;
    
    // Pick best cash flow module
    let cashFlowModule = summaryRes.cashflowStatementHistory;
    let isQuarterly = false;

    if (!cashFlowModule?.cashflowStatements?.length) {
      cashFlowModule = summaryRes.cashflowStatementHistoryQuarterly;
      isQuarterly = true;
    }
    
    const chartRes = await yahooFinance.chart(ticker, { 
      period1: new Date(new Date().setFullYear(new Date().getFullYear() - 5)),
      interval: '1mo' 
    });

    // IMPROVED: Case-insensitive deep scanner for property values
    const getVal = (obj: any, patterns: string[]) => {
      if (!obj) return 0;
      const keys = Object.keys(obj);
      for (const pattern of patterns) {
        // Match exact or contains pattern (case-insensitive)
        const foundKey = keys.find(k => k.toLowerCase().includes(pattern.toLowerCase()));
        if (foundKey && (obj[foundKey]?.raw !== undefined || typeof obj[foundKey] === 'number')) {
          return obj[foundKey]?.raw ?? obj[foundKey];
        }
      }
      return 0;
    };

    const ocfPatterns = ['totalCashFromOperating', 'operatingCashflow', 'cashFromOperating', 'netCashProvidedByOperating'];
    const capexPatterns = ['capitalExpenditure', 'capex', 'additionsToPropertyPlantAndEquipment'];

    const historicalFCF = (cashFlowModule?.cashflowStatements || []).slice(0, 5).map((stmt: any) => {
      const ocf = getVal(stmt, ocfPatterns);
      const capex = getVal(stmt, capexPatterns);
      
      return {
        date: stmt.endDate ? new Date(stmt.endDate).toISOString().split('T')[0] : 'N/A',
        fcf: (ocf + capex) / 1e9,
        ocf: ocf / 1e9,
        capex: capex / 1e9,
        isQuarterly
      };
    }).filter((item: any) => item.date !== 'N/A' && (item.ocf !== 0 || item.capex !== 0));

    // Determine current FCF
    let currentFCF = null;
    if (historicalFCF.length > 0) {
      currentFCF = historicalFCF[0].fcf;
    } else if (finData?.freeCashflow) {
      currentFCF = finData.freeCashflow / 1e9;
    } else if (finData?.operatingCashflow) {
      currentFCF = (finData.operatingCashflow * 0.9) / 1e9; // 10% capex estimate fallback
    }

    const data = {
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
      totalCash: finData?.totalCash ? finData.totalCash / 1e9 : (stats?.totalCash ? (stats.totalCash as any) / 1e9 : 0),
      totalDebt: finData?.totalDebt ? finData.totalDebt / 1e9 : (stats?.totalDebt ? (stats.totalDebt as any) / 1e9 : 0),
      // Financial Ratios
      returnOnEquity: finData?.returnOnEquity ? finData.returnOnEquity * 100 : (stats?.returnOnEquity ? stats.returnOnEquity * 100 : null),
      returnOnAssets: finData?.returnOnAssets ? finData.returnOnAssets * 100 : (stats?.returnOnAssets ? stats.returnOnAssets * 100 : null),
      debtToEquity: finData?.debtToEquity || stats?.debtToEquity || null,
      currentRatio: finData?.currentRatio || stats?.currentRatio || null,
      operatingMargins: finData?.operatingMargins ? finData.operatingMargins * 100 : (stats?.operatingMargins ? stats.operatingMargins * 100 : null),
      freeCashFlow: currentFCF,
      historicalFCF,
      sector: summaryRes.summaryProfile?.sector,
      industry: summaryRes.summaryProfile?.industry,
      history: chartRes.quotes.map((q: any) => ({
        date: q.date.toISOString().split('T')[0],
        price: q.close
      })).filter((q: any) => q.price !== null),
      // Debug info to see what modules were actually returned
      debug: {
        hasCashFlowYearly: !!summaryRes.cashflowStatementHistory?.cashflowStatements?.length,
        hasCashFlowQuarterly: !!summaryRes.cashflowStatementHistoryQuarterly?.cashflowStatements?.length,
        hasFinData: !!summaryRes.financialData,
        availableModules: Object.keys(summaryRes)
      }
    };

    return NextResponse.json(data);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Yahoo Finance Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stock data', details: errorMessage }, { status: 500 });
  }
}
