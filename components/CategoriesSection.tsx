'use client'

import React, { useState, useEffect } from 'react'
import { Tags, Pencil, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'

interface Category {
  id: string
  name: string
  _count?: { sales: number }
}

export default function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const fetchCategories = () => {
    setIsLoading(true)
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    if (res.ok) {
      setNewName('')
      fetchCategories()
    } else {
      toast.error((await res.json()).error || 'Failed to create category')
    }
  }

  const handleRename = async (id: string) => {
    if (!editName.trim()) return
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    })
    if (res.ok) {
      setEditingId(null)
      fetchCategories()
    } else {
      toast.error((await res.json()).error || 'Failed to rename category')
    }
  }

  const handleDelete = async (cat: Category) => {
    const used = cat._count?.sales || 0
    const msg = used
      ? `"${cat.name}" is used in ${used} order(s). Deleting it will remove the category from those orders. Continue?`
      : `Delete "${cat.name}"?`
    if (!confirm(msg)) return
    const res = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' })
    if (res.ok) fetchCategories()
    else toast.error('Failed to delete category')
  }

  return (
    <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Tags className="h-5 w-5 text-sky-600" />
          Product Categories
        </h2>
        <p className="text-xs text-slate-500">Used to group and filter orders</p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row items-center gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category (e.g. Car Mats)"
          className="w-full sm:w-64 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition"
        >
          Create Category
        </button>
      </form>

      {isLoading ? (
        <div className="h-12 bg-slate-100/40 rounded-xl animate-pulse" />
      ) : categories.length === 0 ? (
        <p className="text-xs text-slate-500">No categories yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {categories.map((c) => (
            <div
              key={c.id}
              className="bg-slate-100/60 border border-slate-300/60 rounded-xl p-3 flex items-center justify-between gap-2"
            >
              {editingId === c.id ? (
                <>
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(c.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="flex-1 min-w-0 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                  <button onClick={() => handleRename(c.id)} className="p-1 text-emerald-600 hover:text-emerald-700">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-slate-500 hover:text-slate-900">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm truncate">{c.name}</h4>
                    <p className="text-[11px] text-slate-500">{c._count?.sales || 0} orders</p>
                  </div>
                  <div className="flex shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(c.id)
                        setEditName(c.name)
                      }}
                      className="p-1.5 text-slate-500 hover:text-sky-600"
                      title="Rename"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(c)} className="p-1.5 text-slate-500 hover:text-rose-600" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
