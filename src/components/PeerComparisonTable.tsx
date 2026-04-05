import React from "react";
import { Users } from "lucide-react";

interface PeerData {
  symbol: string;
  shortName: string;
  price: number;
  currency: string;
  peRatio: number | null;
  forwardPE: number | null;
  priceToSales: number | null;
  priceToBook: number | null;
  dividendYield: number | null;
  marketCap: number;
}

interface PeerComparisonTableProps {
  mainTicker: string;
  peers: PeerData[];
}

export const PeerComparisonTable: React.FC<PeerComparisonTableProps> = ({
  mainTicker,
  peers,
}) => {
  if (!peers || peers.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-slate-900">Peer Comparison</h3>
      </div>
      <table className="w-full text-sm text-left border-collapse min-w-[600px]">
        <thead>
          <tr className="bg-slate-50">
            <th className="p-3 border-b text-slate-500 font-medium">Ticker</th>
            <th className="p-3 border-b text-slate-500 font-medium text-right">Mkt Cap (B)</th>
            <th className="p-3 border-b text-slate-500 font-medium text-right">P/E (TTM)</th>
            <th className="p-3 border-b text-slate-500 font-medium text-right">Fwd P/E</th>
            <th className="p-3 border-b text-slate-500 font-medium text-right">P/S</th>
            <th className="p-3 border-b text-slate-500 font-medium text-right">Div. Yield</th>
          </tr>
        </thead>
        <tbody>
          {peers.map((peer) => {
            const isMain = peer.symbol === mainTicker;
            return (
              <tr 
                key={peer.symbol} 
                className={`${isMain ? "bg-blue-50/50 font-bold border-l-4 border-l-blue-500" : "hover:bg-slate-50"}`}
              >
                <td className="p-3 border-b">
                  <div className="flex flex-col">
                    <span className="text-blue-600 font-bold">{peer.symbol}</span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[150px]">{peer.shortName}</span>
                  </div>
                </td>
                <td className="p-3 border-b text-right">
                   {peer.marketCap ? `${peer.marketCap.toFixed(1)}B` : "---"}
                </td>
                <td className="p-3 border-b text-right">
                  {peer.peRatio ? peer.peRatio.toFixed(1) : "---"}
                </td>
                <td className="p-3 border-b text-right">
                  {peer.forwardPE ? peer.forwardPE.toFixed(1) : "---"}
                </td>
                <td className="p-3 border-b text-right">
                  {peer.priceToSales ? peer.priceToSales.toFixed(1) : "---"}
                </td>
                <td className="p-3 border-b text-right text-green-600">
                  {peer.dividendYield ? `${peer.dividendYield.toFixed(2)}%` : "---"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-slate-400 italic">
        * Valuation multiples compared across direct industry peers identified by Gemini AI.
      </p>
    </div>
  );
};
