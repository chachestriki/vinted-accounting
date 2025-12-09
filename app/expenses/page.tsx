"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  RefreshCw,
  Calendar,
  TrendingUp,
  Package,
  ChevronLeft,
  ChevronRight,
  Star,
  ShoppingBag,
  Plus,
  X,
  Edit,
  Trash2,
} from "lucide-react";
import apiClient from "@/libs/api";

interface Expense {
  _id: string;
  category: "destacado" | "armario" | "otros";
  amount: number;
  discount: number;
  totalAmount: number;
  description?: string;
  itemCount?: number;
  expenseDate: string;
  snippet?: string;
}

interface ExpenseForm {
  category: string;
  amount: string;
  discount: string;
  description: string;
  itemCount: string;
  expenseDate: string;
}

interface ExpenseStats {
  total: { count: number; totalAmount: number };
  thisMonth: { count: number; totalAmount: number };
  destacado: { count: number; totalAmount: number };
  armario: { count: number; totalAmount: number };
  otros: { count: number; totalAmount: number };
}

interface ExpensesData {
  expenses: Expense[];
  total: number;
  stats: ExpenseStats;
}

const ITEMS_PER_PAGE = 20;

const categoryNames: Record<string, string> = {
  destacado: "Destacado",
  armario: "Armario",
  otros: "Otros",
};

const categoryColors: Record<string, string> = {
  destacado: "bg-purple-100 text-purple-800",
  armario: "bg-blue-100 text-blue-800",
  otros: "bg-gray-100 text-gray-800",
};

const categoryIcons: Record<string, any> = {
  destacado: Star,
  armario: ShoppingBag,
  otros: Package,
};

export default function ExpensesPage() {
  const [expensesData, setExpensesData] = useState<ExpensesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Date filter
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Add/Edit expense modal
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({
    category: "destacado",
    amount: "",
    discount: "0",
    description: "",
    itemCount: "0",
    expenseDate: new Date().toISOString().split("T")[0],
  });

  // Delete confirmation
  const [deletingExpense, setDeletingExpense] = useState<string | null>(null);

  useEffect(() => {
    fetchExpensesData();
  }, [selectedCategory]);

  const fetchExpensesData = async () => {
    try {
      setLoading(true);
      setError(null);
      const categoryParam = selectedCategory !== "all" ? `?category=${selectedCategory}` : "";
      const response = await apiClient.get(`/expenses${categoryParam}`);
      setExpensesData(response as unknown as ExpensesData);
      setCurrentPage(1);
    } catch (err: any) {
      console.error("Error fetching expenses:", err);
      setError(err?.response?.data?.error || err?.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  };

  const syncExpenses = async () => {
    try {
      setSyncing(true);
      setError(null);
      await apiClient.post("/expenses/sync", {});
      await fetchExpensesData();
    } catch (err: any) {
      console.error("Error syncing:", err);
      setError(err?.response?.data?.error || err?.message || "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const openAddModal = () => {
    setEditingExpense(null);
    setExpenseForm({
      category: "destacado",
      amount: "",
      discount: "0",
      description: "",
      itemCount: "0",
      expenseDate: new Date().toISOString().split("T")[0],
    });
    setShowModal(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      category: expense.category,
      amount: expense.amount.toString(),
      discount: expense.discount.toString(),
      description: expense.description || "",
      itemCount: expense.itemCount?.toString() || "0",
      expenseDate: new Date(expense.expenseDate).toISOString().split("T")[0],
    });
    setShowModal(true);
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.category || !expenseForm.amount) {
      alert("La categoría y el monto son requeridos");
      return;
    }

    try {
      setSavingExpense(true);

      if (editingExpense) {
        // Update existing expense
        await apiClient.patch(`/expenses/${editingExpense._id}`, {
          category: expenseForm.category,
          amount: parseFloat(expenseForm.amount),
          discount: parseFloat(expenseForm.discount) || 0,
          description: expenseForm.description,
          itemCount: parseInt(expenseForm.itemCount) || 0,
          expenseDate: expenseForm.expenseDate,
        });
      } else {
        // Create new expense
        await apiClient.post("/expenses/manual", {
          category: expenseForm.category,
          amount: parseFloat(expenseForm.amount),
          discount: parseFloat(expenseForm.discount) || 0,
          description: expenseForm.description,
          itemCount: parseInt(expenseForm.itemCount) || 0,
          expenseDate: expenseForm.expenseDate,
        });
      }

      setShowModal(false);
      await fetchExpensesData();
    } catch (err: any) {
      console.error("Error saving expense:", err);
      alert(err?.response?.data?.error || "Error al guardar el gasto");
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este gasto?")) {
      return;
    }

    try {
      setDeletingExpense(expenseId);
      await apiClient.delete(`/expenses/${expenseId}`);
      await fetchExpensesData();
    } catch (err: any) {
      console.error("Error deleting expense:", err);
      alert(err?.response?.data?.error || "Error al eliminar el gasto");
    } finally {
      setDeletingExpense(null);
    }
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

  // Pagination and filtering
  let expenses = expensesData?.expenses || [];
  
  // Apply date filter
  let filteredExpenses = expenses;
  const hasDateFilter = startDate || endDate;
  
  if (hasDateFilter) {
    filteredExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.expenseDate);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      if (start && end) {
        return expenseDate >= start && expenseDate <= end;
      } else if (start) {
        return expenseDate >= start;
      } else if (end) {
        return expenseDate <= end;
      }
      return true;
    });
  }

  // Calculate KPI stats
  // If date filter is active, show filtered total
  // If no date filter, show all expenses total
  const kpiTotal = hasDateFilter 
    ? filteredExpenses.reduce((sum, e) => sum + e.totalAmount, 0)
    : expensesData?.stats.total.totalAmount || 0;
  const kpiCount = hasDateFilter 
    ? filteredExpenses.length
    : expensesData?.stats.total.count || 0;
  const kpiLabel = hasDateFilter ? "Total Filtrado" : "Gastos Totales";
  
  expenses = filteredExpenses;

  const totalPages = Math.ceil(expenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = expenses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
              Gestión de Gastos
            </h1>
            <p className="text-gray-500">
              Rastreando {expensesData?.stats.total.count || 0} gastos empresariales para calcular beneficios exactos.
            </p>
          </div>

          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Añadir Gasto
            </button>
            <button
              onClick={syncExpenses}
              disabled={syncing || loading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar Gmail"}
            </button>
          </div>
        </div>

        {loading && !expensesData ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="loading loading-spinner loading-lg mb-4"></span>
            <p className="text-gray-500">Cargando gastos...</p>
          </div>
        ) : error ? (
          <div className="alert alert-error mb-6">
            <span>{error}</span>
            <button className="btn btn-sm" onClick={fetchExpensesData}>
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total Filtered or All Expenses */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    hasDateFilter ? 'bg-blue-100' : 'bg-red-100'
                  }`}>
                    {hasDateFilter ? (
                      <Calendar className={`w-5 h-5 ${hasDateFilter ? 'text-blue-600' : 'text-red-600'}`} />
                    ) : (
                      <DollarSign className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatCurrency(kpiTotal)}
                </div>
                <div className="text-sm text-gray-500">{kpiLabel}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {kpiCount} gasto{kpiCount !== 1 ? 's' : ''} {hasDateFilter ? 'en rango' : 'registrados'}
                </div>
              </div>

              {/* This Month */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatCurrency(expensesData?.stats.thisMonth.totalAmount || 0)}
                </div>
                <div className="text-sm text-gray-500">Este Mes</div>
                <div className="text-xs text-gray-400 mt-1">
                  {expensesData?.stats.thisMonth.count || 0} gastos este mes
                </div>
              </div>

              {/* Destacado */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Star className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {expensesData?.stats.destacado.count || 0}
                </div>
                <div className="text-sm text-gray-500">Destacado</div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatCurrency(expensesData?.stats.destacado.totalAmount || 0)} total
                </div>
              </div>

              {/* General */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-teal-600" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {(expensesData?.stats.armario.count || 0) + (expensesData?.stats.otros.count || 0)}
                </div>
                <div className="text-sm text-gray-500">Generales</div>
                <div className="text-xs text-gray-400 mt-1">
                  Armario y otros gastos
                </div>
              </div>
            </div>

            {/* All Expenses Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Todos los Gastos
                    </h2>
                    <p className="text-sm text-gray-500">
                      Mostrando {paginatedExpenses.length} de {expenses.length} gastos
                    </p>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Todas las Categorías</option>
                      <option value="destacado">Destacado</option>
                      <option value="armario">Armario</option>
                      <option value="otros">Otros</option>
                    </select>
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Desde:</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Hasta:</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <button
                      onClick={clearDateFilter}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Limpiar Filtro
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                {expenses.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No hay gastos registrados</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Haz clic en "Sincronizar Gmail" para importar tus gastos
                    </p>
                  </div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                            Categoría
                          </th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                            Cantidad
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                            Descripción
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                            Fecha
                          </th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedExpenses.map((expense) => {
                          const CategoryIcon = categoryIcons[expense.category];
                          return (
                            <tr
                              key={expense._id}
                              className="border-b border-gray-50 hover:bg-gray-50"
                            >
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                    categoryColors[expense.category]
                                  }`}
                                >
                                  <CategoryIcon className="w-3 h-3" />
                                  {categoryNames[expense.category]}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm font-semibold text-red-600 text-right">
                                {formatCurrency(expense.totalAmount)}
                              </td>
                              <td className="py-3 px-4">
                                <p className="text-sm text-gray-600 max-w-xs truncate">
                                  {expense.description || "—"}
                                </p>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600">
                                {formatDate(expense.expenseDate)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => openEditModal(expense)}
                                    className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Editar"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteExpense(expense._id)}
                                    disabled={deletingExpense === expense._id}
                                    className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                    title="Eliminar"
                                  >
                                    {deletingExpense === expense._id ? (
                                      <span className="loading loading-spinner loading-xs"></span>
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                        <p className="text-sm text-gray-500">
                          Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                          {Math.min(currentPage * ITEMS_PER_PAGE, expenses.length)} de{" "}
                          {expenses.length} gastos
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
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingExpense ? "Editar Gasto" : "Añadir Nuevo Gasto"}
                </h3>
                <p className="text-sm text-gray-500">
                  {editingExpense
                    ? "Actualiza la información del gasto."
                    : "Añade un gasto manual a tu registro."}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría <span className="text-red-500">*</span>
                </label>
                <select
                  value={expenseForm.category}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="destacado">Destacado</option>
                  <option value="armario">Armario</option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto (€) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={expenseForm.amount}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, amount: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descuento (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={expenseForm.discount}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, discount: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, description: e.target.value })
                  }
                  placeholder="Ej: Destacado internacional de 3 días"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad de Artículos
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={expenseForm.itemCount}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, itemCount: e.target.value })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={expenseForm.expenseDate}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, expenseDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {expenseForm.amount && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(
                        parseFloat(expenseForm.amount || "0") -
                          parseFloat(expenseForm.discount || "0")
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveExpense}
                disabled={savingExpense || !expenseForm.category || !expenseForm.amount}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {savingExpense ? (
                  <span className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-xs"></span>
                    Guardando...
                  </span>
                ) : editingExpense ? (
                  "Actualizar Gasto"
                ) : (
                  "Añadir Gasto"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
