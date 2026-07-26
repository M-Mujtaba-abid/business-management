"use client";

interface NetBalanceSummaryProps {
  nomanProfit: number;
  mujtabaProfit: number;
  nomanExpenses: number;
  mujtabaExpenses: number;
  isLoading?: boolean;
  error?: string | null;
}

function BalanceCard({
  name,
  profit,
  expenses,
  accentBorder,
  accentText,
}: {
  name: string;
  profit: number;
  expenses: number;
  accentBorder: string;
  accentText: string;
}) {
  const netBalance = profit - expenses;
  const netColor = netBalance >= 0 ? "text-green-600" : "text-red-600";
  const netBorder = netBalance >= 0 ? "border-green-500" : "border-red-500";

  return (
    <div
      className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${accentBorder}`}
    >
      <h3 className={`text-lg font-bold ${accentText} mb-4`}>{name}</h3>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-sm font-semibold">
            Total Profit
          </span>
          <span className="text-green-600 font-bold">
            ${profit.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-sm font-semibold">
            Total Expenses
          </span>
          <span className="text-red-600 font-bold">
            ${expenses.toFixed(2)}
          </span>
        </div>

        <div
          className={`border-t-2 ${netBorder} pt-3 flex justify-between items-center`}
        >
          <span className="text-gray-700 text-sm font-bold uppercase tracking-wide">
            Net Balance
          </span>
          <span className={`text-2xl font-bold ${netColor}`}>
            ${netBalance.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function NetBalanceSummary({
  nomanProfit,
  mujtabaProfit,
  nomanExpenses,
  mujtabaExpenses,
  isLoading = false,
  error = null,
}: NetBalanceSummaryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {["Noman", "Mujtaba"].map((name) => (
          <div
            key={name}
            className="bg-white rounded-lg shadow-md p-6 border-l-4 border-gray-300 animate-pulse"
          >
            <div className="h-6 bg-gray-200 rounded w-24 mb-4" />
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-8 bg-gray-200 rounded mt-4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
        <p className="font-semibold mb-1">Failed to load net balance data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <BalanceCard
        name="Noman"
        profit={nomanProfit}
        expenses={nomanExpenses}
        accentBorder="border-blue-500"
        accentText="text-blue-600"
      />
      <BalanceCard
        name="Mujtaba"
        profit={mujtabaProfit}
        expenses={mujtabaExpenses}
        accentBorder="border-purple-500"
        accentText="text-purple-600"
      />
    </div>
  );
}
