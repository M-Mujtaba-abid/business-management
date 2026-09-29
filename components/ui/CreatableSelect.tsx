'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, Check, X } from 'lucide-react'

export interface SelectOption {
  id: string
  name: string
}

interface CreatableSelectProps {
  options: SelectOption[]
  value: string
  onChange: (id: string) => void
  onCreate: (name: string) => Promise<SelectOption | null>
  placeholder?: string
  createLabel?: string
  autoOpen?: boolean
}

// Searchable dropdown: if the typed name doesn't exist, offers a "+ Create" button
export default function CreatableSelect({
  options,
  value,
  onChange,
  onCreate,
  placeholder = 'Select...',
  createLabel = 'Create',
  autoOpen = false,
}: CreatableSelectProps) {
  const [isOpen, setIsOpen] = useState(autoOpen)
  const [query, setQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.id === value)
  const trimmed = query.trim()
  const filtered = options.filter((o) => o.name.toLowerCase().includes(trimmed.toLowerCase()))
  const exactMatch = options.some((o) => o.name.toLowerCase() === trimmed.toLowerCase())

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (id: string) => {
    onChange(id)
    setQuery('')
    setIsOpen(false)
  }

  const handleCreate = async () => {
    if (!trimmed || isCreating) return
    setIsCreating(true)
    try {
      const created = await onCreate(trimmed)
      if (created) handleSelect(created.id)
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (filtered.length > 0 && (exactMatch || !trimmed)) {
      const match = filtered.find((o) => o.name.toLowerCase() === trimmed.toLowerCase()) || filtered[0]
      handleSelect(match.id)
    } else if (trimmed) {
      handleCreate()
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:border-emerald-500 transition"
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-500'}>
          {selected ? selected.name : placeholder}
        </span>
        <span className="flex items-center gap-1">
          {selected && (
            <X
              className="h-3.5 w-3.5 text-slate-500 hover:text-rose-600"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
            />
          )}
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-200">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or type a new name..."
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => handleSelect(o.id)}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-700 hover:bg-slate-100 flex items-center justify-between"
              >
                {o.name}
                {o.id === value && <Check className="h-3.5 w-3.5 text-emerald-600" />}
              </button>
            ))}
            {filtered.length === 0 && !trimmed && (
              <p className="px-3 py-2 text-xs text-slate-500">Nothing here yet. Type a name to create one.</p>
            )}
          </div>

          {trimmed && !exactMatch && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full px-3 py-2 text-xs font-bold text-left text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 border-t border-slate-200 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {isCreating ? 'Creating...' : `${createLabel} "${trimmed}"`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
