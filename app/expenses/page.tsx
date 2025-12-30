"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  Filter,
  TrendingDown,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  X,
} from "lucide-react";
import apiClient from "@/libs/api";
import DateFilter, { type DateRange } from "@/components/DateFilter";

interface Expense {
  _id: string;
  emailId: string;
  type: "armario" | "destacado";
  description: string;
  amount: number;
  expenseDate: string;
  snippet?: string;
  isManual?: boolean;
}

interface ExpensesData {
  expenses: Expense[];
  total: number;
  stats: {
    total: { count: number; totalAmount: number };
    byType: Array<{ _id: "armario" | "destacado"; count: number; totalAmount: number }>;
  };
}

const ITEMS_PER_PAGE = 10;

export default function ExpensesPage() {
  const [expensesData, setExpensesData] = useState<ExpensesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>("thisMonth");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Add expense modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [newExpenseForm, setNewExpenseForm] = useState({
    type: "armario" as "armario" | "destacado",
    description: "",
    amount: "",
    expenseDate: new Date().toISOString().split("T")[0],
  });

  // Edit expense modal
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({
    type: "armario" as "armario" | "destacado",
    description: "",
    amount: "",
    expenseDate: "",
  });
  const [updatingExpense, setUpdatingExpense] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<string | null>(null);

  const fetchExpensesData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let url = "/expenses";
      const params: string[] = [];

      if (selectedType !== "all") {
        params.push(`type=${selectedType}`);
      }

      if (selectedDateRange === "custom" && (customStartDate || customEndDate)) {
        if (customStartDate) {
          params.push(`startDate=${new Date(customStartDate).toISOString()}`);
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          params.push(`endDate=${end.toISOString()}`);
        }
      } else if (selectedDateRange !== "allTime" && selectedDateRange !== "custom") {
        const { start, end } = getDateRange(selectedDateRange);
        if (start) {
          params.push(`startDate=${start.toISOString()}`);
        }
        if (end) {
          params.push(`endDate=${end.toISOString()}`);
        }
      }

      if (params.length > 0) {
        url += `?${params.join("&")}`;
      }

      const response = await apiClient.get(url);
      setExpensesData(response as unknown as ExpensesData);
      setCurrentPage(1); // Reset to first page when filters change
    } catch (err: any) {
      console.error("Error fetching expenses:", err);
      setError(
        err?.response?.data?.error || err?.message || "Error al cargar los gastos"
      );
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedDateRange, customStartDate, customEndDate]);

  useEffect(() => {
    fetchExpensesData();
  }, [fetchExpensesData]);

  const addExpense = async () => {
    try {
      setAddingExpense(true);
      setError(null);

      if (!newExpenseForm.description.trim()) {
        setError("La descripción es requerida");
        return;
      }

      if (!newExpenseForm.amount || parseFloat(newExpenseForm.amount) <= 0) {
        setError("El monto debe ser mayor a 0");
        return;
      }

      await apiClient.post("/expenses/manual", newExpenseForm);
      await fetchExpensesData();
      setShowAddModal(false);
      setNewExpenseForm({
        type: "armario",
        description: "",
        amount: "",
        expenseDate: new Date().toISOString().split("T")[0],
      });
    } catch (err: any) {
      console.error("Error adding expense:", err);
      setError(
        err?.response?.data?.error || err?.message || "Error al añadir el gasto"
      );
    } finally {
      setAddingExpense(false);
    }
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setEditForm({
      type: expense.type,
      description: expense.description,
      amount: expense.amount.toString(),
      expenseDate: new Date(expense.expenseDate).toISOString().split("T")[0],
    });
  };

  const updateExpense = async () => {
    if (!editingExpense) return;

    try {
      setUpdatingExpense(true);
      setError(null);

      if (!editForm.description.trim()) {
        setError("La descripción es requerida");
        return;
      }

      if (!editForm.amount || parseFloat(editForm.amount) <= 0) {
        setError("El monto debe ser mayor a 0");
        return;
      }

      await apiClient.put(`/expenses/${editingExpense._id}`, editForm);
      await fetchExpensesData();
      setEditingExpense(null);
    } catch (err: any) {
      console.error("Error updating expense:", err);
      setError(
        err?.response?.data?.error || err?.message || "Error al actualizar el gasto"
      );
    } finally {
      setUpdatingExpense(false);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este gasto?")) {
      return;
    }

    try {
      setDeletingExpense(expenseId);
      setError(null);

      await apiClient.delete(`/expenses/${expenseId}`);
      await fetchExpensesData();
    } catch (err: any) {
      console.error("Error deleting expense:", err);
      setError(
        err?.response?.data?.error || err?.message || "Error al eliminar el gasto"
      );
    } finally {
      setDeletingExpense(null);
    }
  };

  const getDateRange = (range: DateRange): { start: Date | null; end: Date | null } => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    switch (range) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case "last7days":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case "last14days":
        start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case "thisMonth":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case "last3months":
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case "thisYear":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      default:
        break;
    }

    return { start, end };
  };

  const handleDateRangeChange = (range: DateRange) => {
    setSelectedDateRange(range);
    setShowDatePicker(range === "custom");

    if (range !== "custom") {
      setCustomStartDate("");
      setCustomEndDate("");
    }
  };

  const applyCustomDateFilter = () => {
    if (customStartDate || customEndDate) {
      setSelectedDateRange("custom");
      fetchExpensesData();
    }
    setShowDatePicker(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Filtrar y paginar gastos
  const filteredExpenses = expensesData?.expenses || [];
  const totalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const armarioStats = expensesData?.stats.byType.find((s) => s._id === "armario") || {
    count: 0,
    totalAmount: 0,
  };
  const destacadoStats = expensesData?.stats.byType.find((s) => s._id === "destacado") || {
    count: 0,
    totalAmount: 0,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
              Gastos
            </h1>
            <p className="text-gray-500">
              Gestiona tus gastos de promoción en Vinted (armario y destacados).
            </p>
            {expensesData && (
              <p className="text-sm text-gray-400 mt-1">
                Total: {expensesData.total} gastos • Mostrando: {filteredExpenses.length} gastos
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Añadir Gasto
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total de Gastos</p>
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(expensesData?.stats.total.totalAmount || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {expensesData?.stats.total.count || 0} gastos registrados
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Armario</p>
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(armarioStats.totalAmount)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {armarioStats.count} gastos
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Destacados</p>
              <DollarSign className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(destacadoStats.totalAmount)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {destacadoStats.count} gastos
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Tipo:</span>
            <button
              onClick={() => setSelectedType("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedType === "all"
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
            >
              Todos
            </button>
            <button
              onClick={() => setSelectedType("armario")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedType === "armario"
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
            >
              Armario
            </button>
            <button
              onClick={() => setSelectedType("destacado")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedType === "destacado"
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
            >
              Destacados
            </button>
          </div>

          {/* Date Filter */}
          <div>
            <DateFilter
              selectedRange={selectedDateRange}
              onRangeChange={handleDateRangeChange}
            />
          </div>

          {/* Custom Date Picker */}
          {showDatePicker && (
            <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-gray-900">Seleccionar fechas personalizadas</span>
              </div>

              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Desde</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={applyCustomDateFilter}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>

        {loading && !expensesData ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="loading loading-spinner loading-lg mb-4"></span>
            <p className="text-gray-500">Cargando gastos...</p>
          </div>
        ) : error ? (
          <div className="alert alert-error mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
            <button className="btn btn-sm" onClick={fetchExpensesData}>
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {/* Expenses Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  Lista de Gastos
                </h2>
              </div>

              {paginatedExpenses.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <TrendingDown className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay gastos para mostrar</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedType !== "all" || selectedDateRange !== "allTime"
                      ? "Intenta cambiar los filtros"
                      : "Sincroniza tu Gmail para importar gastos"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                            Fecha
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                            Descripción
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                            Tipo
                          </th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                            Monto
                          </th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedExpenses.map((expense) => (
                          <tr
                            key={expense._id}
                            className="border-b border-gray-50 hover:bg-gray-50"
                          >
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {formatDate(expense.expenseDate)}
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-sm font-medium text-gray-900">
                                {expense.description}
                                {expense.isManual && (
                                  <span className="ml-2 text-xs text-gray-400">(Manual)</span>
                                )}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${expense.type === "armario"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-purple-100 text-purple-800"
                                  }`}
                              >
                                {expense.type === "armario" ? "Armario" : "Destacado"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm font-semibold text-red-600 text-right">
                              {formatCurrency(expense.amount)}
                            </td>
                            <td className="py-3 px-4">
                              {expense.isManual ? (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => openEditModal(expense)}
                                    className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Editar"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteExpense(expense._id)}
                                    disabled={deletingExpense === expense._id}
                                    className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                      <p className="text-sm text-gray-500">
                        Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredExpenses.length)} de{" "}
                        {filteredExpenses.length} gastos
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Anterior
                        </button>
                        <span className="text-sm text-gray-600">
                          Página {currentPage} de {totalPages}
                        </span>
                        <button
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={currentPage === totalPages}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Siguiente
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* Add Expense Modal */}
        {showAddModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Añadir Gasto</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Gasto
                  </label>
                  <select
                    value={newExpenseForm.type}
                    onChange={(e) =>
                      setNewExpenseForm({ ...newExpenseForm, type: e.target.value as "armario" | "destacado" })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="armario">Armario</option>
                    <option value="destacado">Destacado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={newExpenseForm.description}
                    onChange={(e) =>
                      setNewExpenseForm({ ...newExpenseForm, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Armario en escaparate (7 días)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newExpenseForm.amount}
                    onChange={(e) =>
                      setNewExpenseForm({ ...newExpenseForm, amount: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={newExpenseForm.expenseDate}
                    onChange={(e) =>
                      setNewExpenseForm({ ...newExpenseForm, expenseDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={addExpense}
                  disabled={addingExpense}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {addingExpense ? "Añadiendo..." : "Añadir Gasto"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Expense Modal */}
        {editingExpense && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Editar Gasto</h2>
                <button
                  onClick={() => setEditingExpense(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Gasto
                  </label>
                  <select
                    value={editForm.type}
                    onChange={(e) =>
                      setEditForm({ ...editForm, type: e.target.value as "armario" | "destacado" })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="armario">Armario</option>
                    <option value="destacado">Destacado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.amount}
                    onChange={(e) =>
                      setEditForm({ ...editForm, amount: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={editForm.expenseDate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, expenseDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={updateExpense}
                  disabled={updatingExpense}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {updatingExpense ? "Actualizando..." : "Actualizar Gasto"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
