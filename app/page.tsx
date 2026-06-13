"use client";

import { useState, useEffect } from "react";
import SaleForm from "./components/SaleForm";
import SaleCard from "./components/SaleCard";
import Stats from "./components/Stats";
import ExpenseCard from "./components/ExpenseCard";
import AddExpenseForm from "./components/AddExpenseForm";
import NetBalanceSummary from "./components/NetBalanceSummary";

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

interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  createdAt: string;
}

interface SalesApiResponse {
  sales: Sale[];
  totalSales: number;
  totalProfit: number;
  count: number;
}

interface ExpensesApiResponse {
  expenses: Expense[];
  totalExpenses: number;
  count: number;
}

type ActiveTab = "sales" | "expenses";

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("sales");

  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalProfit: 0,
    count: 0,
  });

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseStats, setExpenseStats] = useState({
    totalExpenses: 0,
    count: 0,
  });

  const [nomanProfit, setNomanProfit] = useState(0);
  const [mujtabaProfit, setMujtabaProfit] = useState(0);
  const [nomanExpenses, setNomanExpenses] = useState(0);
  const [mujtabaExpenses, setMujtabaExpenses] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isExpenseLoading, setIsExpenseLoading] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isDeletingExpenseId, setIsDeletingExpenseId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedProfitHolder, setSelectedProfitHolder] =
    useState<string>("all");
  const [selectedPaidBy, setSelectedPaidBy] = useState<string>("all");

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

  const buildQueryParams = (extraParams: Record<string, string> = {}) => {
    const queryParams = new URLSearchParams();
    if (selectedMonth !== "all") queryParams.append("month", selectedMonth);
    if (selectedYear !== "all") queryParams.append("year", selectedYear);
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value !== "all") queryParams.append(key, value);
    });
    return queryParams.toString();
  };

  const fetchSales = async () => {
    try {
      const query = buildQueryParams({ profitHolder: selectedProfitHolder });
      const response = await fetch(`/api/sales?${query}`);
      if (!response.ok) throw new Error("Failed to fetch sales");

      const data: SalesApiResponse = await response.json();
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

  const fetchExpenses = async () => {
    try {
      const query = buildQueryParams({ paidBy: selectedPaidBy });
      const response = await fetch(`/api/expenses?${query}`);
      if (!response.ok) throw new Error("Failed to fetch expenses");

      const data: ExpensesApiResponse = await response.json();
      setExpenses(data.expenses);
      setExpenseStats({
        totalExpenses: data.totalExpenses,
        count: data.count,
      });
    } catch (err) {
      setError("Failed to load expense data");
      console.error(err);
    }
  };

  const fetchNetBalances = async () => {
    setBalanceLoading(true);
    setBalanceError(null);

    const endpoints = [
      {
        label: "Noman sales",
        url: `/api/sales?${buildQueryParams({ profitHolder: "Noman" })}`,
        onSuccess: (data: SalesApiResponse) => setNomanProfit(data.totalProfit),
      },
      {
        label: "Mujtaba sales",
        url: `/api/sales?${buildQueryParams({ profitHolder: "Mujtaba" })}`,
        onSuccess: (data: SalesApiResponse) =>
          setMujtabaProfit(data.totalProfit),
      },
      {
        label: "Noman expenses",
        url: `/api/expenses?${buildQueryParams({ paidBy: "Noman" })}`,
        onSuccess: (data: ExpensesApiResponse) =>
          setNomanExpenses(data.totalExpenses),
      },
      {
        label: "Mujtaba expenses",
        url: `/api/expenses?${buildQueryParams({ paidBy: "Mujtaba" })}`,
        onSuccess: (data: ExpensesApiResponse) =>
          setMujtabaExpenses(data.totalExpenses),
      },
    ] as const;

    const failures: string[] = [];

    await Promise.all(
      endpoints.map(async ({ label, url, onSuccess }) => {
        try {
          console.log(`[NetBalance] Fetching ${label}:`, url);
          const response = await fetch(url);
          const data = await response.json();
          console.log(`[NetBalance] ${label} response:`, response.status, data);

          if (!response.ok) {
            const reason = data?.error || `HTTP ${response.status}`;
            failures.push(`${label} (${url}): ${reason}`);
            return;
          }

          onSuccess(data);
        } catch (err) {
          const reason = err instanceof Error ? err.message : "Unknown error";
          console.error(`[NetBalance] ${label} failed:`, err);
          failures.push(`${label} (${url}): ${reason}`);
        }
      }),
    );

    if (failures.length > 0) {
      setBalanceError(failures.join(" | "));
    }

    setBalanceLoading(false);
  };

  useEffect(() => {
    fetchSales();
    fetchExpenses();
    fetchNetBalances();
  }, [selectedMonth, selectedYear, selectedProfitHolder, selectedPaidBy]);

  const handleFormSubmit = async (formData: any) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

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
      setEditingSale(null);
      await Promise.all([fetchSales(), fetchNetBalances()]);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save sale data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpenseSubmit = async (formData: {
    description: string;
    amount: string;
    paidBy: string;
    createdAt: string;
  }) => {
    setIsExpenseLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add expense");
      }

      setSuccess("Expense added successfully!");
      await Promise.all([fetchExpenses(), fetchNetBalances()]);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save expense data");
    } finally {
      setIsExpenseLoading(false);
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
      if (editingSale?.id === id) setEditingSale(null);
      await Promise.all([fetchSales(), fetchNetBalances()]);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete sale");
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    setIsDeletingExpenseId(id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete expense");

      setSuccess("Expense deleted successfully!");
      await Promise.all([fetchExpenses(), fetchNetBalances()]);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete expense");
    } finally {
      setIsDeletingExpenseId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-4xl font-bold text-gray-900">
            📊 Business Manager
          </h1>
          <p className="text-gray-600 mt-1">Track your sales, expenses, and profits</p>
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

        <NetBalanceSummary
          nomanProfit={nomanProfit}
          mujtabaProfit={mujtabaProfit}
          nomanExpenses={nomanExpenses}
          mujtabaExpenses={mujtabaExpenses}
          isLoading={balanceLoading}
          error={balanceError}
        />

        {/* Tab Toggle */}
        <div className="bg-white rounded-lg shadow-md p-1 mb-6 flex">
          <button
            onClick={() => setActiveTab("sales")}
            className={`flex-1 py-3 px-4 rounded-md font-bold text-sm transition ${
              activeTab === "sales"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            Sales
          </button>
          <button
            onClick={() => setActiveTab("expenses")}
            className={`flex-1 py-3 px-4 rounded-md font-bold text-sm transition ${
              activeTab === "expenses"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            Expenses
          </button>
        </div>

        {/* Filter UI Row */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="text-lg font-semibold text-gray-700">
            Filter Records
          </div>
          <div className="flex flex-wrap gap-4">
            {activeTab === "sales" ? (
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
            ) : (
              <div>
                <select
                  value={selectedPaidBy}
                  onChange={(e) => setSelectedPaidBy(e.target.value)}
                  className="block w-44 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none text-gray-700 font-medium bg-gray-50"
                >
                  <option value="all">All Payers</option>
                  <option value="Noman">Noman</option>
                  <option value="Mujtaba">Mujtaba</option>
                  <option value="Shared">Shared</option>
                </select>
              </div>
            )}
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

        {activeTab === "sales" ? (
          <>
            <Stats
              totalSales={stats.totalSales}
              totalProfit={stats.totalProfit}
              count={stats.count}
            />

            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
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
                editData={editingSale}
              />
            </div>

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
                        window.scrollTo({ top: 300, behavior: "smooth" });
                      }}
                      isDeleting={isDeletingId === sale.id}
                      isCurrentlyEditing={editingSale?.id === sale.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
                <p className="text-gray-600 text-sm font-semibold mb-2">
                  TOTAL EXPENSES
                </p>
                <p className="text-3xl font-bold text-red-600 mb-2">
                  ${expenseStats.totalExpenses.toFixed(2)}
                </p>
                <p className="text-gray-500 text-xs">
                  {expenseStats.count} transactions
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
                <p className="text-gray-600 text-sm font-semibold mb-2">
                  EXPENSE COUNT
                </p>
                <p className="text-3xl font-bold text-yellow-600 mb-2">
                  {expenseStats.count}
                </p>
                <p className="text-gray-500 text-xs">
                  {expenseStats.count > 0
                    ? `Avg: $${(expenseStats.totalExpenses / expenseStats.count).toFixed(2)}`
                    : "No expenses"}
                </p>
              </div>
            </div>

            <div className="mb-8">
              <AddExpenseForm
                onSubmit={handleExpenseSubmit}
                isLoading={isExpenseLoading}
              />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                All Expenses ({expenseStats.count})
              </h2>
              {expenses.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                  <p className="text-gray-500 text-lg">
                    No expenses found for the selected parameters. 🚀
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {expenses.map((expense) => (
                    <ExpenseCard
                      key={expense.id}
                      expense={expense}
                      onDelete={handleDeleteExpense}
                      isDeleting={isDeletingExpenseId === expense.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
