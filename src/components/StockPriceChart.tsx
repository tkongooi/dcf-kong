import React from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from "recharts";

interface StockPriceChartProps {
  history: { date: string; price: number }[];
  intrinsicValue: number;
  ticker: string;
}

export const StockPriceChart: React.FC<StockPriceChartProps> = ({ history, intrinsicValue, ticker }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-slate-900">{ticker} Share Price History (5Y)</h3>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <span className="text-slate-500">Market Price</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-green-500" />
            <span className="text-slate-500">Fair Value</span>
          </div>
        </div>
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history}>
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
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={(val) => `${val.toFixed(0)}`}
              domain={['auto', 'auto']}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              labelFormatter={(date) => new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
              formatter={(val: any) => [`${Number(val).toFixed(2)}`, "Price"]}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="#2563eb" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorPrice)" 
            />
            <ReferenceLine 
              y={intrinsicValue} 
              stroke="#22c55e" 
              strokeDasharray="3 3" 
              label={{ 
                value: `Fair Value: ${intrinsicValue.toFixed(2)}`, 
                position: 'right', 
                fill: '#15803d', 
                fontSize: 10,
                fontWeight: 'bold'
              }} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
