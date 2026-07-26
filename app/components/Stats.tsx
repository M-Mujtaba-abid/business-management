"use client";

interface StatsProps {
  totalSales: number;
  totalProfit: number;
  count: number;
}

export default function Stats({ totalSales, totalProfit, count }: StatsProps) {
  const profitColor = totalProfit >= 0 ? "text-green-600" : "text-red-600";
  const profitBorder = totalProfit >= 0 ? "border-green-500" : "border-red-500";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {/* Total Sales */}
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
        <p className="text-gray-600 text-sm font-semibold mb-2">TOTAL SALES</p>
        <p className="text-3xl font-bold text-blue-600 mb-2">
          {totalSales.toFixed(2)}
        </p>
        <p className="text-gray-500 text-xs">{count} transactions</p>
      </div>

      {/* Total Profit */}
      <div
        className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${profitBorder}`}
      >
        <p className="text-gray-600 text-sm font-semibold mb-2">TOTAL PROFIT</p>
        <p className={`text-3xl font-bold ${profitColor} mb-2`}>
          {totalProfit.toFixed(2)}
        </p>
        <p className="text-gray-500 text-xs">
          {count > 0 ? `Avg: ${(totalProfit / count).toFixed(2)}` : "No sales"}
        </p>
      </div>

      {/* Profit Margin */}
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
        <p className="text-gray-600 text-sm font-semibold mb-2">
          PROFIT MARGIN
        </p>
        <p className="text-3xl font-bold text-purple-600 mb-2">
          {totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : "0"}
          %
        </p>
        <p className="text-gray-500 text-xs">Based on sales</p>
      </div>
    </div>
  );
}
