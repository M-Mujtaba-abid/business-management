'use client'

import { useState } from 'react'

interface FormProps {
  onSubmit: (data: any) => void
  isLoading: boolean
}

export default function SaleForm({ onSubmit, isLoading }: FormProps) {
  const [formData, setFormData] = useState({
    productName: '',
    customerName: '',
    address: '',
    cost: '',
    soldPrice: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.productName.trim()) newErrors.productName = 'Product name is required'
    if (!formData.customerName.trim()) newErrors.customerName = 'Customer name is required'
    if (!formData.address.trim()) newErrors.address = 'Address is required'
    if (!formData.cost || isNaN(parseFloat(formData.cost))) newErrors.cost = 'Valid cost is required'
    if (!formData.soldPrice || isNaN(parseFloat(formData.soldPrice))) newErrors.soldPrice = 'Valid sold price is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    onSubmit(formData)

    // Reset form
    setFormData({
      productName: '',
      customerName: '',
      address: '',
      cost: '',
      soldPrice: '',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Sale</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Product Name */}
        <div className="flex flex-col">
          <label htmlFor="productName" className="text-gray-700 font-semibold mb-2">
            Product Name
          </label>
          <input
            type="text"
            id="productName"
            name="productName"
            value={formData.productName}
            onChange={handleChange}
            placeholder="e.g., Top Cover"
            className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              errors.productName ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.productName && (
            <span className="text-red-500 text-sm mt-1">{errors.productName}</span>
          )}
        </div>

        {/* Customer Name */}
        <div className="flex flex-col">
          <label htmlFor="customerName" className="text-gray-700 font-semibold mb-2">
            Customer Name
          </label>
          <input
            type="text"
            id="customerName"
            name="customerName"
            value={formData.customerName}
            onChange={handleChange}
            placeholder="Customer name"
            className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              errors.customerName ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.customerName && (
            <span className="text-red-500 text-sm mt-1">{errors.customerName}</span>
          )}
        </div>

        {/* Address */}
        <div className="flex flex-col">
          <label htmlFor="address" className="text-gray-700 font-semibold mb-2">
            Address
          </label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Customer address"
            className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              errors.address ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.address && (
            <span className="text-red-500 text-sm mt-1">{errors.address}</span>
          )}
        </div>

        {/* Cost */}
        <div className="flex flex-col">
          <label htmlFor="cost" className="text-gray-700 font-semibold mb-2">
            Cost Price
          </label>
          <input
            type="number"
            id="cost"
            name="cost"
            value={formData.cost}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              errors.cost ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.cost && (
            <span className="text-red-500 text-sm mt-1">{errors.cost}</span>
          )}
        </div>

        {/* Sold Price */}
        <div className="flex flex-col">
          <label htmlFor="soldPrice" className="text-gray-700 font-semibold mb-2">
            Sold Price
          </label>
          <input
            type="number"
            id="soldPrice"
            name="soldPrice"
            value={formData.soldPrice}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              errors.soldPrice ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.soldPrice && (
            <span className="text-red-500 text-sm mt-1">{errors.soldPrice}</span>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="mt-6 w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Adding...' : 'Add Sale'}
      </button>
    </form>
  )
}
