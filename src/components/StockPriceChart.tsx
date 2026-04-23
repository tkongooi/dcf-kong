import React, { useMemo } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ReferenceLine,
  Line,
  ComposedChart,
} from "recharts";

interface StockPriceChartProps {
  history: { date: string; price: number }[];
  intrinsicValue: number;
  ticker: string;
}

export const StockPriceChart: React.FC<StockPriceChartProps> = ({ history, intrinsicValue, ticker }) => {
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];

    const data = history.map(h => ({ ...h } as { date: string; price: number; ma12?: number; rsi?: number }));
    
    // 1. Calculate 12-Month Moving Average (MA12) - Since interval is '1mo'
    for (let i = 0; i < data.length; i++) {
      if (i >= 11) {
        const slice = data.slice(i - 11, i + 1);
        const sum = slice.reduce((acc, curr) => acc + curr.price, 0);
        data[i].ma12 = sum / 12;
      }
    }

    // 2. Calculate RSI (14)
    let avgGain = 0;
    let avgLoss = 0;
    const rsiPeriod = 14;

    for (let i = 1; i < data.length; i++) {
      const change = data[i].price - data[i - 1].price;
      const gain = Math.max(0, change);
      const loss = Math.max(0, -change);

      if (i <= rsiPeriod) {
        avgGain += gain / rsiPeriod;
        avgLoss += loss / rsiPeriod;
        if (i === rsiPeriod) {
          const rs = avgGain / (avgLoss || 1);
          data[i].rsi = 100 - (100 / (1 + rs));
        }
      } else {
        avgGain = (avgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
        avgLoss = (avgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;
        const rs = avgGain / (avgLoss || 1);
        data[i].rsi = 100 - (100 / (1 + rs));
      }
    }

    return data;
  }, [history]);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <h3 className="text-lg font-semibold text-slate-900">{ticker} Share Price History (5Y)</h3>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-tight">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
            <span className="text-slate-500">Market Price</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-0.5 bg-green-500" />
            <span className="text-slate-500">Fair Value</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-0.5 bg-amber-500" />
            <span className="text-slate-500">MA(12M)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-purple-600">RSI(14)</span>
          </div>
        </div>
      </div>
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 10 }} 
              dy={10}
              tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, { year: '2-digit', month: 'short' })}
            />
            <YAxis 
              yAxisId="left"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={(val) => `${val.toFixed(0)}`}
              domain={['auto', 'auto']}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#a855f7', fontSize: 9 }}
              domain={[0, 100]}
              hide={true} // Keep hidden to avoid clutter, accessible via tooltip
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              labelFormatter={(date) => new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
              formatter={(val, name) => {
                if (name === "price") return [`$${Number(val).toFixed(2)}`, "Price"];
                if (name === "ma12") return [`$${Number(val).toFixed(2)}`, "MA (12M)"];
                if (name === "rsi") return [`${Number(val).toFixed(1)}`, "RSI (14)"];
                return [String(val), String(name)];
              }}
            />
            <Area 
              yAxisId="left"
              type="monotone" 
              dataKey="price" 
              stroke="#2563eb" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorPrice)" 
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="ma12" 
              stroke="#f59e0b" 
              strokeWidth={1.5} 
              dot={false}
              strokeDasharray="4 4"
            />
            {/* RSI as a hidden data key to make it available in tooltip */}
            <Line 
              yAxisId="right"
              dataKey="rsi" 
              stroke="transparent" 
              dot={false}
              activeDot={false}
            />
            <ReferenceLine 
              yAxisId="left"
              y={intrinsicValue} 
              stroke="#22c55e" 
              strokeDasharray="3 3" 
              label={{ 
                value: `Fair Value: ${intrinsicValue.toFixed(2)}`, 
                position: 'insideRight', 
                fill: '#15803d', 
                fontSize: 9,
                fontWeight: 'bold',
                offset: 10
              }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* RSI Indicator Info */}
      {chartData.length > 0 && chartData[chartData.length - 1].rsi != null && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current RSI:</span>
            <span className={`text-sm font-bold ${chartData[chartData.length - 1].rsi! > 70 ? 'text-red-500' : chartData[chartData.length - 1].rsi! < 30 ? 'text-green-500' : 'text-purple-600'}`}>
              {chartData[chartData.length - 1].rsi!.toFixed(1)}
            </span>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              <span className="text-[9px] text-slate-500 font-medium">Overbought (&gt;70)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span className="text-[9px] text-slate-500 font-medium">Oversold (&lt;30)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
