"use client";

import { useState, useEffect } from "react";

interface FormProps {
  onSubmit: (data: any) => void;
  isLoading: boolean;
  editData?: any;
}

export default function SaleForm({ onSubmit, isLoading, editData }: FormProps) {
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    productName: "",
    customerName: "",
    address: "",
    cost: "",
    soldPrice: "",
    profitHolder: "",
    createdAt: today,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editData) {
      const parsedDate = editData.createdAt
        ? editData.createdAt.split("T")[0]
        : today;

      setFormData({
        productName: editData.productName || "",
        customerName: editData.customerName || "",
        address: editData.address || "",
        cost: editData.cost?.toString() || "",
        soldPrice: editData.soldPrice?.toString() || "",
        profitHolder: editData.profitHolder || "",
        createdAt: parsedDate,
      });
      setErrors({});
    } else {
      setFormData({
        productName: "",
        customerName: "",
        address: "",
        cost: "",
        soldPrice: "",
        profitHolder: "",
        createdAt: today,
      });
    }
  }, [editData]);

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

    if (!formData.productName.trim())
      newErrors.productName = "Product name is required";
    if (!formData.cost || isNaN(parseFloat(formData.cost)))
      newErrors.cost = "Valid cost is required";
    if (!formData.soldPrice || isNaN(parseFloat(formData.soldPrice)))
      newErrors.soldPrice = "Valid sold price is required";
    if (!formData.profitHolder)
      newErrors.profitHolder = "Please select a profit holder";
    if (!formData.createdAt) newErrors.createdAt = "Please select a date";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    onSubmit(formData);

    if (!editData) {
      setFormData({
        productName: "",
        customerName: "",
        address: "",
        cost: "",
        soldPrice: "",
        profitHolder: "",
        createdAt: today,
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-white rounded-lg shadow-md p-6 mb-6 border transition-all duration-300 ${
        editData ? "border-blue-400 bg-blue-50/10" : "border-transparent"
      }`}
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        {editData ? "📝 Edit Transaction Details" : "Add New Sale"}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Product Name */}
        <div className="flex flex-col">
          <label
            htmlFor="productName"
            className="text-gray-700 font-semibold mb-2"
          >
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
              errors.productName ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.productName && (
            <span className="text-red-500 text-sm mt-1">
              {errors.productName}
            </span>
          )}
        </div>

        {/* Date Field Selection */}
        <div className="flex flex-col">
          <label
            htmlFor="createdAt"
            className="text-gray-700 font-semibold mb-2"
          >
            Sale Date
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

        {/* Customer Name */}
        <div className="flex flex-col">
          <label
            htmlFor="customerName"
            className="text-gray-700 font-semibold mb-2"
          >
            Customer Name{" "}
            <span className="text-gray-400 font-normal text-sm">
              (Optional)
            </span>
          </label>
          <input
            type="text"
            id="customerName"
            name="customerName"
            value={formData.customerName}
            onChange={handleChange}
            placeholder="Customer name"
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Address */}
        <div className="flex flex-col">
          <label htmlFor="address" className="text-gray-700 font-semibold mb-2">
            Address{" "}
            <span className="text-gray-400 font-normal text-sm">
              (Optional)
            </span>
          </label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Customer address"
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Cost Price */}
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
            step="1"
            min="0"
            className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              errors.cost ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.cost && (
            <span className="text-red-500 text-sm mt-1">{errors.cost}</span>
          )}
        </div>

        {/* Sold Price */}
        <div className="flex flex-col">
          <label
            htmlFor="soldPrice"
            className="text-gray-700 font-semibold mb-2"
          >
            Sold Price
          </label>
          <input
            type="number"
            id="soldPrice"
            name="soldPrice"
            value={formData.soldPrice}
            onChange={handleChange}
            placeholder="0"
            step="1"
            min="0"
            className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              errors.soldPrice ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.soldPrice && (
            <span className="text-red-500 text-sm mt-1">
              {errors.soldPrice}
            </span>
          )}
        </div>

        {/* Profit Holder */}
        <div className="flex flex-col">
          <label
            htmlFor="profitHolder"
            className="text-gray-700 font-semibold mb-2"
          >
            Profit Holder
          </label>
          <select
            id="profitHolder"
            name="profitHolder"
            value={formData.profitHolder}
            onChange={handleChange}
            className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              errors.profitHolder ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Select profit holder</option>
            <option value="Mujtaba">Mujtaba</option>
            <option value="Noman">Noman</option>
          </select>
          {errors.profitHolder && (
            <span className="text-red-500 text-sm mt-1">
              {errors.profitHolder}
            </span>
          )}
        </div>
      </div>

      {/* FIXED TAG BELOW */}
      <button
        type="submit"
        disabled={isLoading}
        className={`mt-6 w-full md:w-auto font-bold py-3 px-6 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed ${
          editData
            ? "bg-amber-500 hover:bg-amber-600 text-white"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        {isLoading
          ? editData
            ? "Updating..."
            : "Adding..."
          : editData
            ? "Update Details"
            : "Add Sale"}
      </button>
    </form>
  );
}
