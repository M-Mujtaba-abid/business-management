"use client";

interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  createdAt: string;
}

interface ExpenseCardProps {
  expense: Expense;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export default function ExpenseCard({
  expense,
  onDelete,
  isDeleting,
}: ExpenseCardProps) {
  const formattedDate = new Date(expense.createdAt).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  );

  const paidByBadgeColor =
    expense.paidBy === "Noman"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : expense.paidBy === "Mujtaba"
        ? "bg-purple-50 text-purple-700 border-purple-200"
        : "bg-yellow-50 text-yellow-700 border-yellow-200";

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition overflow-hidden border border-gray-100 flex flex-col justify-between">
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">
              {expense.description}
            </h3>
            <p className="text-gray-500 text-sm">{formattedDate}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onDelete(expense.id)}
              disabled={isDeleting}
              className="text-red-500 hover:text-red-700 font-semibold text-sm disabled:text-gray-400 transition"
            >
              {isDeleting ? "..." : "Delete"}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            Paid By
          </span>
          <span
            className={`inline-block px-2.5 py-1 text-xs font-bold rounded-md border ${paidByBadgeColor}`}
          >
            {expense.paidBy}
          </span>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <div className="bg-red-50 rounded-lg p-4 text-center border border-red-100">
            <p className="text-gray-400 text-xs font-bold mb-1 tracking-wide">
              AMOUNT
            </p>
            <p className="text-red-600 font-bold text-2xl">
              ${expense.amount.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
