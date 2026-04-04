import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  const { ticker, type, context, history } = await request.json(); 

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Gemini API Key not configured" }, { status: 500 });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    if (type === "combined") {
      const prompt = `Perform deep research on the stock ticker ${ticker}. 
      1. Suggest initial values for a DCF analysis in JSON format at the VERY END of your response.
      2. Provide a qualitative analysis on the applicability of a DCF model for this stock and what an investor should watch out for.
      
      The JSON format must be:
      {
        "fcf": number (in Billions),
        "wacc": number (percentage),
        "growthRate": number (percentage for next 5 years),
        "terminalGrowth": number (percentage),
        "years": number (typically 5 or 10),
        "reasoning": "brief explanation"
      }`;
      const result = await model.generateContent(prompt);
      return NextResponse.json({ text: result.response.text() });
    }

    if (type === "research") {
      const prompt = `Perform deep research on the stock ticker ${ticker}. 
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
      const prompt = `Analyze the stock ticker ${ticker} and comment on the applicability of a DCF model for it. 
      What should an investor watch out for? Give a concise but comprehensive overview.`;
      const result = await model.generateContent(prompt);
      return NextResponse.json({ text: result.response.text() });
    }

    // Default to "chat" type
    // Gemini API requires history to start with "user" role.
    // Filter out the initial assistant greeting if it's the first message.
    const chatHistory = [];
    let foundFirstUser = false;

    for (const m of (history || [])) {
      if (!foundFirstUser && m.role !== "user") continue;
      foundFirstUser = true;
      chatHistory.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }

    const chat = model.startChat({
      history: chatHistory,
    });
    
    // Use context if provided, otherwise a default prompt
    const userMessage = context || "Tell me more about this stock.";
    const result = await chat.sendMessage(userMessage);
    const text = result.response.text();

    return NextResponse.json({ text });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
