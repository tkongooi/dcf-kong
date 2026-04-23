import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Strip characters that could redirect the prompt; cap length.
function sanitize(input: unknown, maxLen = 200): string {
  if (typeof input !== "string") return "";
  return input.replace(/[\r\n{}`]/g, " ").trim().slice(0, maxLen);
}

// Pre-check common aliases before paying for an AI round-trip.
const TICKER_ALIASES: Record<string, string> = {
  GEELY: "0175.HK",
};

export async function POST(request: Request) {
  const { ticker, type, context, history } = await request.json();

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Gemini API Key not configured" }, { status: 500 });
  }

  const safeTicker = sanitize(ticker, 32);
  const safeContext = sanitize(context, 500);

  try {
    const model = genAI.getGenerativeModel({ model: "gemma-4-31b-it" });

    if (type === "peers") {
      const prompt = `Identify 4-5 direct industry competitors (stock tickers) for ${safeTicker}.
      Only return a JSON array of strings, for example: ["AAPL", "MSFT", "GOOGL"].
      Do not include any other text.`;
      const result = await model.generateContent(prompt);
      return NextResponse.json({ text: result.response.text() });
    }

    if (type === "resolve-ticker") {
      const aliasHit = TICKER_ALIASES[safeContext.toUpperCase()];
      if (aliasHit) {
        return NextResponse.json({
          text: JSON.stringify({
            ticker: aliasHit,
            confidence: "high",
            suggestions: [],
            reasoning: "Matched local alias table.",
          }),
        });
      }

      const prompt = `Find the most likely stock ticker symbol for the following company or search query: "${safeContext}".
      Consider global exchanges including US (NYSE, NASDAQ), Hong Kong (.HK), Mainland China (.SS, .SZ), Malaysia (.KL), etc.

      Return a JSON object with:
      {
        "ticker": "STRING or null",
        "confidence": "high|medium|low",
        "suggestions": ["ARRAY OF STRINGS, each in format 'TICKER (Company Name)'"],
        "reasoning": "brief explanation"
      }
      Always include suggestions if there are multiple exchanges for the same company. Only return the JSON object.`;
      const result = await model.generateContent(prompt);
      return NextResponse.json({ text: result.response.text() });
    }

    if (type === "all-in-one") {
      const prompt = `Perform deep research on the stock ticker ${safeTicker}.
      1. Suggest initial values for a DCF analysis.
      2. Identify 4-5 direct industry competitors (tickers).
      3. Provide a qualitative analysis on the applicability of a DCF model for this stock.

      The response MUST end with a JSON object in this EXACT format:
      {
        "dcf": {
          "fcf": number (in Billions),
          "wacc": number (percentage),
          "growthRate": number (percentage for next 5 years),
          "terminalGrowth": number (percentage),
          "years": number (5 or 10),
          "transitionYears": number (typically 5),
          "historicalFCF": [{"date": "YYYY-MM-DD", "fcf": number}],
          "reasoning": "string"
        },
        "peers": ["TICKER1", "TICKER2", "TICKER3", "TICKER4"],
        "analysis": "Your qualitative analysis text here"
      }`;
      const result = await model.generateContent(prompt);
      return NextResponse.json({ text: result.response.text() });
    }

    if (type === "combined") {
      const prompt = `Perform deep research on the stock ticker ${safeTicker}.
      1. Suggest initial values for a DCF analysis in JSON format at the VERY END of your response.
      2. Provide a qualitative analysis on the applicability of a DCF model for this stock and what an investor should watch out for.

      The JSON format must be:
      {
        "fcf": number (in Billions),
        "wacc": number (percentage),
        "growthRate": number (percentage for next 5 years),
        "terminalGrowth": number (percentage),
        "years": number (typically 5 or 10),
        "historicalFCF": [
          {"date": "YYYY-MM-DD", "fcf": number}
        ],
        "reasoning": "brief explanation"
      }`;
      const result = await model.generateContent(prompt);
      return NextResponse.json({ text: result.response.text() });
    }

    if (type === "research") {
      const prompt = `Perform deep research on the stock ticker ${safeTicker}.
      Suggest initial values for a DCF analysis in JSON format:
      {
        "fcf": number (in Billions),
        "wacc": number (percentage),
        "growthRate": number (percentage for next 5 years),
        "terminalGrowth": number (percentage),
        "years": number (typically 5 or 10),
        "reasoning": "brief explanation"
      }
      Only return the JSON object.`;
      const result = await model.generateContent(prompt);
      return NextResponse.json({ text: result.response.text() });
    }

    if (type === "commentary") {
      const prompt = `Analyze the stock ticker ${safeTicker} and comment on the applicability of a DCF model for it.
      What should an investor watch out for? Give a concise but comprehensive overview.`;
      const result = await model.generateContent(prompt);
      return NextResponse.json({ text: result.response.text() });
    }

    // Default: free-form chat. Gemini requires history to start with a user turn.
    const chatHistory: { role: string; parts: { text: string }[] }[] = [];
    let foundFirstUser = false;
    for (const m of (history || [])) {
      if (!foundFirstUser && m.role !== "user") continue;
      foundFirstUser = true;
      chatHistory.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }

    const chat = model.startChat({ history: chatHistory });
    const userMessage = safeContext || "Tell me more about this stock.";
    const result = await chat.sendMessage(userMessage);
    return NextResponse.json({ text: result.response.text() });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
