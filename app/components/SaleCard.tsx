'use client'

interface Sale {
  id: string
  productName: string
  customerName: string
  address: string
  cost: number
  soldPrice: number
  profit: number
  createdAt: string
}

interface SaleCardProps {
  sale: Sale
  onDelete: (id: string) => void
  isDeleting: boolean
}

export default function SaleCard({ sale, onDelete, isDeleting }: SaleCardProps) {
  const formattedDate = new Date(sale.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const profitColor = sale.profit >= 0 ? 'text-green-600' : 'text-red-600'
  const profitBg = sale.profit >= 0 ? 'bg-green-50' : 'bg-red-50'

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition overflow-hidden">
      <div className="p-5">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{sale.productName}</h3>
            <p className="text-gray-500 text-sm">{formattedDate}</p>
          </div>
          <button
            onClick={() => onDelete(sale.id)}
            disabled={isDeleting}
            className="text-red-500 hover:text-red-700 font-semibold text-sm disabled:text-gray-400"
          >
            {isDeleting ? '...' : 'Delete'}
          </button>
        </div>

        {/* Customer Info */}
        <div className="border-t border-gray-200 pt-4 mb-4">
          <p className="text-gray-700 font-semibold text-sm mb-2">
            <span className="text-gray-500">Customer:</span> {sale.customerName}
          </p>
          <p className="text-gray-700 font-semibold text-sm">
            <span className="text-gray-500">Address:</span> {sale.address}
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs font-semibold mb-1">COST</p>
            <p className="text-gray-800 font-bold text-lg">
              {sale.cost.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs font-semibold mb-1">SOLD</p>
            <p className="text-gray-800 font-bold text-lg">
              {sale.soldPrice.toFixed(2)}
            </p>
          </div>
          <div className={`${profitBg} rounded-lg p-3 text-center`}>
            <p className="text-gray-500 text-xs font-semibold mb-1">PROFIT</p>
            <p className={`${profitColor} font-bold text-lg`}>
              {sale.profit.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
