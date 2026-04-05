import YahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';

const yahooFinance = new YahooFinance();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersStr = searchParams.get('tickers');

  if (!tickersStr) {
    return NextResponse.json({ error: 'Tickers are required' }, { status: 400 });
  }

  const tickers = tickersStr.split(',').map(t => t.trim().toUpperCase());

  try {
    const results = await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const quote = await yahooFinance.quote(ticker);
          const summary = await yahooFinance.quoteSummary(ticker, {
            modules: ['summaryDetail', 'defaultKeyStatistics']
          });

          return {
            symbol: ticker,
            shortName: quote.shortName,
            price: quote.regularMarketPrice,
            currency: quote.currency,
            peRatio: quote.trailingPE || summary.summaryDetail?.trailingPE || null,
            forwardPE: quote.forwardPE || summary.summaryDetail?.forwardPE || null,
            priceToSales: summary.summaryDetail?.priceToSalesTrailing12Months || quote.priceToSales || null,
            priceToBook: summary.summaryDetail?.priceToBook || summary.defaultKeyStatistics?.priceToBook || null,
            dividendYield: summary.summaryDetail?.dividendYield ? summary.summaryDetail.dividendYield * 100 : (quote.dividendYield || null),
            marketCap: (quote.marketCap || 0) / 1e9,
          };
        } catch (e) {
          console.error(`Failed to fetch ${ticker}:`, e);
          return { symbol: ticker, error: true };
        }
      })
    );

    return NextResponse.json(results.filter(r => !r.error));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
