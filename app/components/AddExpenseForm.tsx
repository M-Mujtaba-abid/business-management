"use client";

import { useState } from "react";

interface AddExpenseFormProps {
  onSubmit: (data: {
    description: string;
    amount: string;
    paidBy: string;
    createdAt: string;
  }) => void;
  isLoading: boolean;
}

export default function AddExpenseForm({
  onSubmit,
  isLoading,
}: AddExpenseFormProps) {
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    paidBy: "",
    createdAt: today,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.description.trim())
      newErrors.description = "Description is required";
    if (!formData.amount || isNaN(parseFloat(formData.amount)))
      newErrors.amount = "Valid amount is required";
    if (!formData.paidBy) newErrors.paidBy = "Please select who paid";
    if (!formData.createdAt) newErrors.createdAt = "Please select a date";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    onSubmit(formData);

    setFormData({
      description: "",
      amount: "",
      paidBy: "",
      createdAt: today,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow-md p-6 mb-6 border border-transparent"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Expense</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label
            htmlFor="description"
            className="text-gray-700 font-semibold mb-2"
          >
            Description
          </label>
          <input
            type="text"
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="e.g., Office supplies"
            className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              errors.description ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.description && (
            <span className="text-red-500 text-sm mt-1">
              {errors.description}
            </span>
          )}
        </div>

        <div className="flex flex-col">
          <label htmlFor="createdAt" className="text-gray-700 font-semibold mb-2">
            Expense Date
          </label>
          <input
            type="date"
            id="createdAt"
            name="createdAt"
            value={formData.createdAt}
            onChange={handleChange}
            className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              errors.createdAt ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.createdAt && (
            <span className="text-red-500 text-sm mt-1">
              {errors.createdAt}
            </span>
          )}
        </div>

        <div className="flex flex-col">
          <label htmlFor="amount" className="text-gray-700 font-semibold mb-2">
            Amount
          </label>
          <input
            type="number"
            id="amount"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
            placeholder="0"
            min="0"
            className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition 
    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
      errors.amount ? "border-red-500" : "border-gray-300"
    }`}
          />
          {errors.amount && (
            <span className="text-red-500 text-sm mt-1">{errors.amount}</span>
          )}
        </div>

        <div className="flex flex-col">
          <label htmlFor="paidBy" className="text-gray-700 font-semibold mb-2">
            Paid By
          </label>
          <select
            id="paidBy"
            name="paidBy"
            value={formData.paidBy}
            onChange={handleChange}
            className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              errors.paidBy ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Select who paid</option>
            <option value="Noman">Noman</option>
            <option value="Mujtaba">Mujtaba</option>
            <option value="Shared">Shared</option>
          </select>
          {errors.paidBy && (
            <span className="text-red-500 text-sm mt-1">{errors.paidBy}</span>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="mt-6 w-full md:w-auto font-bold py-3 px-6 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 text-white"
      >
        {isLoading ? "Adding..." : "Add Expense"}
      </button>
    </form>
  );
}
