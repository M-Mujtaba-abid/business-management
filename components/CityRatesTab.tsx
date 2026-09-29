'use client'

import React, { useState, useEffect } from 'react'
import { MapPin } from 'lucide-react'
import CategoriesSection from './CategoriesSection'

interface CityRate {
  id: string
  cityName: string
  deliveryFee: number
  updatedAt: string
}

export default function CityRatesTab() {
  const [cities, setCities] = useState<CityRate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cityName, setCityName] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchCities = () => {
    setIsLoading(true)
    fetch('/api/cities/fee')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCities(data)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    fetchCities()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cityName || !deliveryFee) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/cities/fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityName, deliveryFee }),
      })
      if (res.ok) {
        fetchCities()
        setCityName('')
        setDeliveryFee('')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Product Categories (create / rename / delete) */}
      <CategoriesSection />

      {/* Header & Add Rate Form */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-emerald-600" />
            City Delivery Rates Directory
          </h2>
          <p className="text-xs text-slate-500">
            Default courier delivery charges auto-populated during order dispatch
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            required
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            placeholder="City Name (e.g. Sialkot)"
            className="w-full sm:w-64 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            required
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            placeholder="Delivery Fee (Rs. 250)"
            className="w-full sm:w-48 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition"
          >
            Save Rate
          </button>
        </form>
      </div>

      {/* Directory Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : cities.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl">
            <MapPin className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-500 text-sm font-medium">No city rates indexed</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {cities.map((c) => (
              <div
                key={c.id}
                className="bg-slate-100/60 border border-slate-300/60 rounded-xl p-3.5 flex justify-between items-center"
              >
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{c.cityName}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Delivery Charge</p>
                </div>
                <span className="font-mono font-bold text-emerald-600 text-sm bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  Rs. {c.deliveryFee}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
