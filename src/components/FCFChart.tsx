import React from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface FCFChartProps {
  projectedFCF: number[];
  initialFCF: number;
}

export const FCFChart: React.FC<FCFChartProps> = ({ projectedFCF, initialFCF }) => {
  const data = [
    { year: "Year 0", fcf: initialFCF },
    ...projectedFCF.map((fcf, index) => ({
      year: `Year ${index + 1}`,
      fcf: fcf,
    })),
  ];

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-semibold mb-6 text-slate-900">Projected Free Cash Flow (Billion)</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorFcf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="year" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={(val) => `${val.toFixed(1)}B`}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(val: any) => [`${Number(val).toFixed(2)} Billion`, "FCF"]}
            />
            <Area 
              type="monotone" 
              dataKey="fcf" 
              stroke="#2563eb" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorFcf)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
