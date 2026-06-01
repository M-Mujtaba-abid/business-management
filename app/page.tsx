"use client";

import { useState, useEffect } from "react";
import SaleForm from "./components/SaleForm";
import SaleCard from "./components/SaleCard";
import Stats from "./components/Stats";

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

interface ApiResponse {
  sales: Sale[];
  totalSales: number;
  totalProfit: number;
  count: number;
}

export default function Home() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalProfit: 0,
    count: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- Track Active Edit Item ---
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  // --- Filter States ---
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedProfitHolder, setSelectedProfitHolder] =
    useState<string>("all");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) =>
    (currentYear - i).toString(),
  );

  const months = [
    { value: "01", name: "January" },
    { value: "02", name: "February" },
    { value: "03", name: "March" },
    { value: "04", name: "April" },
    { value: "05", name: "May" },
    { value: "06", name: "June" },
    { value: "07", name: "July" },
    { value: "08", name: "August" },
    { value: "09", name: "September" },
    { value: "10", name: "October" },
    { value: "11", name: "November" },
    { value: "12", name: "December" },
  ];

  const fetchSales = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (selectedMonth !== "all") queryParams.append("month", selectedMonth);
      if (selectedYear !== "all") queryParams.append("year", selectedYear);
      if (selectedProfitHolder !== "all")
        queryParams.append("profitHolder", selectedProfitHolder);

      const response = await fetch(`/api/sales?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch sales");

      const data: ApiResponse = await response.json();
      setSales(data.sales);
      setStats({
        totalSales: data.totalSales,
        totalProfit: data.totalProfit,
        count: data.count,
      });
    } catch (err) {
      setError("Failed to load sales data");
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [selectedMonth, selectedYear, selectedProfitHolder]);

  // Handle both ADD and EDIT submissions
  const handleFormSubmit = async (formData: any) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Determine if updating or creating
    const isEditing = !!editingSale;
    const url = isEditing ? `/api/sales/${editingSale.id}` : "/api/sales";
    const method = isEditing ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to ${isEditing ? "update" : "add"} sale`,
        );
      }

      setSuccess(
        isEditing ? "Sale updated successfully!" : "Sale added successfully!",
      );
      setEditingSale(null); // Reset form state context
      await fetchSales();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save sale data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSale = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sale?")) return;
    setIsDeletingId(id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/sales/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete sale");

      setSuccess("Sale deleted successfully!");
      if (editingSale?.id === id) setEditingSale(null); // Cancel current editing if that entry got wiped
      await fetchSales();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete sale");
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-4xl font-bold text-gray-900">
            📊 Business Manager
          </h1>
          <p className="text-gray-600 mt-1">Track your sales and profits</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {/* Filter UI Row */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="text-lg font-semibold text-gray-700">
            Filter Records
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <select
                value={selectedProfitHolder}
                onChange={(e) => setSelectedProfitHolder(e.target.value)}
                className="block w-44 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none text-gray-700 font-medium bg-gray-50"
              >
                <option value="all">All Profit Holders</option>
                <option value="Mujtaba">Mujtaba</option>
                <option value="Noman">Noman</option>
              </select>
            </div>
            <div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="block w-40 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none text-gray-700"
              >
                <option value="all">All Months</option>
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="block w-32 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none text-gray-700"
              >
                <option value="all">All Years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <Stats
          totalSales={stats.totalSales}
          totalProfit={stats.totalProfit}
          count={stats.count}
        />

        {/* Dynamic Form Segment */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            {/* <h2 className="text-xl font-bold text-gray-800">
              {editingSale
                ? "📝 Edit Sale Mode"
                : "➕ Add New Transaction Record"}
            </h2> */}
            {editingSale && (
              <button
                onClick={() => setEditingSale(null)}
                className="text-sm font-semibold text-gray-500 hover:text-gray-800 underline"
              >
                Cancel Edit
              </button>
            )}
          </div>
          <SaleForm
            onSubmit={handleFormSubmit}
            isLoading={isLoading}
            editData={editingSale} // Passed to pre-fill inner fields
          />
        </div>

        {/* Sales Card Rendering Lists */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            All Sales ({stats.count})
          </h2>
          {sales.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-500 text-lg">
                No sales found for the selected parameters. 🚀
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sales.map((sale) => (
                <SaleCard
                  key={sale.id}
                  sale={sale}
                  onDelete={handleDeleteSale}
                  onEdit={(item) => {
                    setEditingSale(item);
                    window.scrollTo({ top: 300, behavior: "smooth" }); // Scroll smoothly back up to fields
                  }}
                  isDeleting={isDeletingId === sale.id}
                  isCurrentlyEditing={editingSale?.id === sale.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
