'use client'

import { useState, useEffect } from 'react'
import SaleForm from './components/SaleForm'
import SaleCard from './components/SaleCard'
import Stats from './components/Stats'

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

interface ApiResponse {
  sales: Sale[]
  totalSales: number
  totalProfit: number
  count: number
}

export default function Home() {
  const [sales, setSales] = useState<Sale[]>([])
  const [stats, setStats] = useState({
    totalSales: 0,
    totalProfit: 0,
    count: 0,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch all sales
  const fetchSales = async () => {
    try {
      const response = await fetch('/api/sales')
      if (!response.ok) throw new Error('Failed to fetch sales')
      
      const data: ApiResponse = await response.json()
      setSales(data.sales)
      setStats({
        totalSales: data.totalSales,
        totalProfit: data.totalProfit,
        count: data.count,
      })
    } catch (err) {
      setError('Failed to load sales data')
      console.error(err)
    }
  }

  // Load sales on mount
  useEffect(() => {
    fetchSales()
  }, [])

  // Add new sale
  const handleAddSale = async (formData: any) => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add sale')
      }

      setSuccess('Sale added successfully!')
      await fetchSales()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to add sale')
    } finally {
      setIsLoading(false)
    }
  }

  // Delete sale
  const handleDeleteSale = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sale?')) return

    setIsDeletingId(id)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/sales/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete sale')

      setSuccess('Sale deleted successfully!')
      await fetchSales()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete sale')
    } finally {
      setIsDeletingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-4xl font-bold text-gray-900">
            📊 Business Manager
          </h1>
          <p className="text-gray-600 mt-1">Track your sales and profits</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Notifications */}
        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Statistics */}
        <Stats
          totalSales={stats.totalSales}
          totalProfit={stats.totalProfit}
          count={stats.count}
        />

        {/* Form */}
        <SaleForm onSubmit={handleAddSale} isLoading={isLoading} />

        {/* Sales List */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            All Sales ({stats.count})
          </h2>

          {sales.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-500 text-lg">
                No sales yet. Add your first sale to get started! 🚀
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sales.map(sale => (
                <SaleCard
                  key={sale.id}
                  sale={sale}
                  onDelete={handleDeleteSale}
                  isDeleting={isDeletingId === sale.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-gray-600">
          <p>Built with Next.js, TypeScript, Tailwind CSS & Neon DB</p>
        </div>
      </footer>
    </main>
  )
}
