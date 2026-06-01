"use client";

interface Sale {
  id: string;
  productName: string;
  customerName: string;
  address: string;
  cost: number;
  soldPrice: number;
  profit: number;
  createdAt: string;
  profitHolder?: string;
}

interface SaleCardProps {
  sale: Sale;
  onDelete: (id: string) => void;
  onEdit: (sale: Sale) => void; // <-- Added
  isDeleting: boolean;
  isCurrentlyEditing?: boolean; // <-- Added tracking indicator style
}

export default function SaleCard({
  sale,
  onDelete,
  onEdit,
  isDeleting,
  isCurrentlyEditing,
}: SaleCardProps) {
  const formattedDate = new Date(sale.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const profitColor = sale.profit >= 0 ? "text-green-600" : "text-red-600";
  const profitBg = sale.profit >= 0 ? "bg-green-50" : "bg-red-50";

  const holderBadgeColor =
    sale.profitHolder === "Noman"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : sale.profitHolder === "Mujtaba"
        ? "bg-purple-50 text-purple-700 border-purple-200"
        : "bg-gray-50 text-gray-600 border-gray-200";

  return (
    <div
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition overflow-hidden border flex flex-col justify-between ${isCurrentlyEditing ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-100"}`}
    >
      <div className="p-5">
        {/* Header containing Actions Row */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">
              {sale.productName}
            </h3>
            <p className="text-gray-500 text-sm">{formattedDate}</p>
          </div>

          {/* Actions Column Button Wrapper */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onEdit(sale)}
              className="text-blue-600 hover:text-blue-800 font-semibold text-sm transition"
            >
              Edit
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => onDelete(sale.id)}
              disabled={isDeleting}
              className="text-red-500 hover:text-red-700 font-semibold text-sm disabled:text-gray-400 transition"
            >
              {isDeleting ? "..." : "Delete"}
            </button>
          </div>
        </div>

        {/* Profit Holder Badge */}
        <div className="mb-4">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            Profit Holder
          </span>
          <span
            className={`inline-block px-2.5 py-1 text-xs font-bold rounded-md border ${holderBadgeColor}`}
          >
            {sale.profitHolder || "Unassigned"}
          </span>
        </div>

        {/* Customer Info */}
        <div className="border-t border-gray-200 pt-4 mb-4 space-y-1">
          <p className="text-gray-700 text-sm">
            <span className="text-gray-400 font-medium">Customer:</span>{" "}
            <span className="font-semibold">{sale.customerName || "N/A"}</span>
          </p>
          <p className="text-gray-700 text-sm">
            <span className="text-gray-400 font-medium">Address:</span>{" "}
            <span className="font-semibold">{sale.address || "N/A"}</span>
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
            <p className="text-gray-400 text-xs font-bold mb-1 tracking-wide">
              COST
            </p>
            <p className="text-gray-800 font-bold text-base">
              ${sale.cost.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
            <p className="text-gray-400 text-xs font-bold mb-1 tracking-wide">
              SOLD
            </p>
            <p className="text-gray-800 font-bold text-base">
              ${sale.soldPrice.toFixed(2)}
            </p>
          </div>
          <div className={`${profitBg} rounded-lg p-3 text-center`}>
            <p className="text-gray-400 text-xs font-bold mb-1 tracking-wide">
              PROFIT
            </p>
            <p className={`${profitColor} font-bold text-base`}>
              ${sale.profit.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
