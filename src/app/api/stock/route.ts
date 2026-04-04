import YahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';

const yahooFinance = new YahooFinance();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
  }

  try {
    const quote = await yahooFinance.quote(ticker);
    
    // Fetch summary profile, detail, and stats in v3
    const summaryRes = await yahooFinance.quoteSummary(ticker, { 
      modules: ['summaryProfile', 'cashflowStatementHistory', 'summaryDetail', 'defaultKeyStatistics'] 
    });

    const summary = summaryRes.summaryProfile;
    const detail = summaryRes.summaryDetail;
    const stats = summaryRes.defaultKeyStatistics;
    const cashFlow = summaryRes.cashflowStatementHistory;
    
    const chartRes = await yahooFinance.chart(ticker, { 
      period1: new Date(new Date().setFullYear(new Date().getFullYear() - 5)),
      interval: '1mo' 
    });

    // Some basic formatting for response
    const data = {
      symbol: quote.symbol,
      price: quote.regularMarketPrice,
      currency: quote.currency,
      shortName: quote.shortName,
      sharesOutstanding: quote.sharesOutstanding ? quote.sharesOutstanding / 1e9 : null,
      marketCap: quote.marketCap ? quote.marketCap / 1e9 : null,
      // Metrics
      peRatio: quote.trailingPE || detail?.trailingPE || null,
      forwardPE: quote.forwardPE || detail?.forwardPE || null,
      priceToBook: detail?.priceToBook || stats?.priceToBook || null,
      priceToSales: detail?.priceToSalesTrailing12Months || quote.priceToSales || null,
      dividendYield: detail?.dividendYield ? detail.dividendYield * 100 : (quote.dividendYield || null),
      beta: detail?.beta || stats?.beta || null,
      
      // Initial FCF calculation: Operating Cash Flow + CapEx (CapEx is usually negative)
      // Convert to Billions
      freeCashFlow: cashFlow && cashFlow.cashflowStatements?.[0] 
        ? ((cashFlow.cashflowStatements[0] as any).totalCashFromOperatingActivities + (cashFlow.cashflowStatements[0] as any).capitalExpenditures) / 1e9
        : null,
      sector: summary?.sector,
      industry: summary?.industry,
      history: chartRes.quotes.map((q: any) => ({
        date: q.date.toISOString().split('T')[0],
        price: q.close
      })).filter((q: any) => q.price !== null)
    };

    return NextResponse.json(data);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Yahoo Finance Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stock data', details: errorMessage }, { status: 500 });
  }
}
