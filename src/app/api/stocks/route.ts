import YahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';

const yahooFinance = new YahooFinance();

const TICKER_RE = /^[A-Z0-9.\-=^]{1,32}$/;
const MAX_TICKERS = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersStr = searchParams.get('tickers');

  if (!tickersStr) {
    return NextResponse.json({ error: 'Tickers are required' }, { status: 400 });
  }

  const rawTickers = tickersStr.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  if (rawTickers.length === 0) {
    return NextResponse.json({ error: 'Tickers are required' }, { status: 400 });
  }
  if (rawTickers.length > MAX_TICKERS) {
    return NextResponse.json({ error: `Too many tickers (max ${MAX_TICKERS})` }, { status: 400 });
  }
  const tickers = Array.from(new Set(rawTickers)).filter(t => TICKER_RE.test(t));
  if (tickers.length === 0) {
    return NextResponse.json({ error: 'No valid tickers' }, { status: 400 });
  }

  try {
    const settled = await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const [quote, summary] = await Promise.all([
            yahooFinance.quote(ticker),
            yahooFinance.quoteSummary(ticker, {
              modules: ['summaryDetail', 'defaultKeyStatistics'],
            }),
          ]);

          return {
            ok: true as const,
            data: {
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
            },
          };
        } catch (e) {
          console.error(`Failed to fetch ${ticker}:`, e);
          return { ok: false as const, ticker };
        }
      })
    );

    const peers = settled.filter((r) => r.ok).map((r) => r.data);
    const failed = settled.filter((r) => !r.ok).map((r) => r.ticker);

    return NextResponse.json({ peers, failed });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
