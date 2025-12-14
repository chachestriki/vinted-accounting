"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Package,
  CheckCircle,
  Clock,
  Truck,
  FileText,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2
} from "lucide-react";
import apiClient from "@/libs/api";

interface Sale {
  _id: string;
  transactionId: string;
  itemName: string;
  amount: number;
  purchasePrice?: number;
  status: "pending" | "completed" | "cancelled";
  shippingCarrier: string;
  trackingNumber?: string;
  shippingDeadline?: string;
  saleDate: string;
  completedDate?: string;
  hasLabel: boolean;
  labelMessageId?: string;
  isManual?: boolean;
}

interface SalesData {
  sales: Sale[];
  total: number;
  stats: {
    pending: { count: number; totalAmount: number };
    completed: { count: number; totalAmount: number };
    total: { count: number; totalAmount: number };
  };
}

interface NewSaleForm {
  itemName: string;
  purchasePrice: string;
  salePrice: string;
  saleDate: string;
}

const carrierNames: Record<string, string> = {
  correos: "Correos",
  inpost: "InPost",
  seur: "SEUR",
  vintedgo: "Vinted Go",
  unknown: "Manual",
};

const carrierColors: Record<string, string> = {
  correos: "bg-yellow-100 text-yellow-800",
  inpost: "bg-orange-100 text-orange-800",
  seur: "bg-blue-100 text-blue-800",
  vintedgo: "bg-teal-100 text-teal-800",
  unknown: "bg-gray-100 text-gray-800",
};

const ITEMS_PER_PAGE = 10;

export default function SalesPage() {
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [downloadingLabel, setDownloadingLabel] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);

  // Add sale modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingSale, setAddingSale] = useState(false);
  const [newSaleForm, setNewSaleForm] = useState<NewSaleForm>({
    itemName: "",
    purchasePrice: "",
    salePrice: "",
    saleDate: new Date().toISOString().split("T")[0],
  });

  // Edit sale modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingSale, setSavingSale] = useState(false);

  // Delete confirmation
  const [deletingSale, setDeletingSale] = useState<string | null>(null);

  // Pagination for completed sales
  const [completedPage, setCompletedPage] = useState(1);
  
  // Edit sale modal
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editSaleForm, setEditSaleForm] = useState({
    itemName: "",
    purchasePrice: "",
    salePrice: "",
    saleDate: "",
    status: "completed" as "pending" | "completed" | "cancelled",
  });
  const [updatingSale, setUpdatingSale] = useState(false);
  
  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get("/sales?status=all");
      setSalesData(response as unknown as SalesData);
      setCompletedPage(1);
    } catch (err: any) {
      console.error("Error fetching sales:", err);
      setError(err?.response?.data?.error || err?.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  };


  const handleAddSale = async () => {
    if (!newSaleForm.itemName.trim()) {
      alert("El nombre del artículo es requerido");
      return;
    }

    try {
      setAddingSale(true);
      await apiClient.post("/sales/manual", {
        itemName: newSaleForm.itemName,
        purchasePrice: parseFloat(newSaleForm.purchasePrice) || 0,
        salePrice: parseFloat(newSaleForm.salePrice) || 0,
        saleDate: newSaleForm.saleDate,
      });
      
      // Reset form and close modal
      setNewSaleForm({
        itemName: "",
        purchasePrice: "",
        salePrice: "",
        saleDate: new Date().toISOString().split("T")[0],
      });
      setShowAddModal(false);
      
      // Refresh sales
      await fetchSalesData();
    } catch (err: any) {
      console.error("Error adding sale:", err);
      alert(err?.response?.data?.error || "Error al añadir la venta");
    } finally {
      setAddingSale(false);
    }
  };

  const openEditModal = (sale: Sale) => {
    setEditingSale(sale);
  
    setEditSaleForm({
      itemName: sale.itemName,
      purchasePrice: sale.purchasePrice?.toString() || "",
      salePrice: sale.amount?.toString() || "",
      saleDate: sale.saleDate.split("T")[0],
      status: sale.status,
    });
  
    setShowEditModal(true);
  };

  const handleEditSale = async () => {
    if (!editingSale) return;

    try {
      setSavingSale(true);
      await apiClient.patch(`/sales/${editingSale._id}`, {
        itemName: editingSale.itemName,
        amount: editingSale.amount,
        purchasePrice: editingSale.purchasePrice || 0,
        status: editingSale.status,
        saleDate: editingSale.saleDate,
        shippingCarrier: editingSale.shippingCarrier,
      });

      setShowEditModal(false);
      setEditingSale(null);
      await fetchSalesData();
    } catch (err: any) {
      console.error("Error editing sale:", err);
      alert(err?.response?.data?.error || "Error al editar la venta");
    } finally {
      setSavingSale(false);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta venta?")) {
      return;
    }

    try {
      setDeletingSale(saleId);
      await apiClient.delete(`/sales/${saleId}`);
      await fetchSalesData();
    } catch (err: any) {
      console.error("Error deleting sale:", err);
      alert(err?.response?.data?.error || "Error al eliminar la venta");
    } finally {
      setDeletingSale(null);
    }
  };

  const downloadLabel = async (saleId: string) => {
    try {
      setDownloadingLabel(saleId);
      
      const downloadUrl = `/api/sales/label?saleId=${saleId}`;
      
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `etiqueta-${saleId}.pdf`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Error downloading label:", err);
      alert("Error al descargar la etiqueta");
    } finally {
      setDownloadingLabel(null);
    }
  };

  const downloadSelectedLabels = async () => {
    if (selectedPending.size === 0) return;

    try {
      setDownloadingLabel("multiple");
      
      // Llamar al endpoint que concatena los PDFs
      const saleIdsArray = Array.from(selectedPending);
      const response = await fetch("/api/sales/label", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ saleIds: saleIdsArray }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al descargar las etiquetas");
      }

      // Descargar el PDF combinado
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `etiquetas-combinadas-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Error downloading labels:", err);
      alert(err?.message || "Error al descargar las etiquetas");
    } finally {
      setDownloadingLabel(null);
    }
  };

  const toggleSelectAll = (sales: Sale[]) => {
    const salesWithLabels = sales.filter(s => s.hasLabel);
    if (selectedPending.size === salesWithLabels.length) {
      setSelectedPending(new Set());
    } else {
      setSelectedPending(new Set(salesWithLabels.map(s => s._id)));
    }
  };

  const toggleSelect = (saleId: string) => {
    const newSelected = new Set(selectedPending);
    if (newSelected.has(saleId)) {
      newSelected.delete(saleId);
    } else {
      newSelected.add(saleId);
    }
    setSelectedPending(newSelected);
  };
  

  
  const updateSale = async () => {
    if (!editingSale) return;
  
    try {
      setUpdatingSale(true);
      setError(null);
  
      const payload = editingSale.isManual
        ? {
            itemName: editSaleForm.itemName,
            purchasePrice: parseFloat(editSaleForm.purchasePrice) || 0,
            salePrice: parseFloat(editSaleForm.salePrice) || 0,
            saleDate: editSaleForm.saleDate,
            status: editSaleForm.status,
          }
        : {
            purchasePrice: parseFloat(editSaleForm.purchasePrice) || 0,
          };
  
      await apiClient.put(`/sales/${editingSale._id}`, payload);
  
      await fetchSalesData();
      setEditingSale(null);
    } catch (err: any) {
      console.error("Error updating sale:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Error al actualizar la venta"
      );
    } finally {
      setUpdatingSale(false);
    }
  };
  
  
  const deleteSale = async (saleId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta venta?")) {
      return;
    }
    
    try {
      setDeletingSale(saleId);
      setError(null);
      
      await apiClient.delete(`/sales/${saleId}`);
      await fetchSalesData();
    } catch (err: any) {
      console.error("Error deleting sale:", err);
      setError(
        err?.response?.data?.error || err?.message || "Error al eliminar la venta"
      );
    } finally {
      setDeletingSale(null);
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

  const formatDeadline = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <span className="text-red-600 font-medium">Vencido</span>;
    } else if (diffDays === 0) {
      return <span className="text-amber-600 font-medium">Hoy</span>;
    } else if (diffDays === 1) {
      return <span className="text-amber-600 font-medium">Mañana</span>;
    } else if (diffDays <= 3) {
      return <span className="text-amber-600">{diffDays} días</span>;
    } else {
      return <span className="text-gray-600">{formatDate(dateString)}</span>;
    }
  };

  // Filter pending sales and sort by date (most recent first)
  const now = new Date();
  const pendingSales = (salesData?.sales || [])
    .filter(s => {
      if (s.status !== "pending") return false;
      
      if (s.shippingDeadline) {
        const deadline = new Date(s.shippingDeadline);
        return now <= deadline;
      }
      
      const saleDate = new Date(s.saleDate);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return saleDate >= sevenDaysAgo;
    })
    .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());

  const completedSales = (salesData?.sales || []).filter(s => s.status === "completed");
  
  // Pagination for completed sales
  const totalCompletedPages = Math.ceil(completedSales.length / ITEMS_PER_PAGE);
  const paginatedCompletedSales = completedSales
    .sort((a, b) => new Date(b.completedDate || b.saleDate).getTime() - new Date(a.completedDate || a.saleDate).getTime())
    .slice((completedPage - 1) * ITEMS_PER_PAGE, completedPage * ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
              Ventas
            </h1>
            <p className="text-gray-500">
              Gestiona tus ventas pendientes y completadas.
            </p>
            {salesData && (
              <p className="text-sm text-gray-400 mt-1">
                Total: {salesData.total} ventas
              </p>
            )}
          </div>

        </div>

        {loading && !salesData ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="loading loading-spinner loading-lg mb-4"></span>
            <p className="text-gray-500">Cargando ventas...</p>
          </div>
        ) : error ? (
          <div className="alert alert-error mb-6">
            <span>{error}</span>
            <button className="btn btn-sm" onClick={fetchSalesData}>
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {/* Ventas Pendientes Section */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
              <div
                className="flex items-center justify-between p-4 border-b border-gray-100 cursor-pointer"
                onClick={() => setShowPending(!showPending)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Ventas Pendientes de Envío
                    </h2>
                    <p className="text-sm text-gray-500">
                      {pendingSales.length} ventas esperando envío (dentro del plazo)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {selectedPending.size > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadSelectedLabels();
                      }}
                      disabled={downloadingLabel === "multiple"}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloadingLabel === "multiple" ? (
                        <>
                          <span className="loading loading-spinner loading-xs"></span>
                          Combinando PDFs...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Descargar {selectedPending.size} Etiquetas
                        </>
                      )}
                    </button>
                  )}
                  {showPending ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {showPending && (
                <div className="overflow-x-auto">
                  {pendingSales.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No hay ventas pendientes dentro del plazo</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Las ventas vencidas se mueven automáticamente a completadas
                      </p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={
                                selectedPending.size ===
                                pendingSales.filter((s) => s.hasLabel).length &&
                                pendingSales.filter((s) => s.hasLabel).length > 0
                              }
                              onChange={() => toggleSelectAll(pendingSales)}
                            />
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                            Fecha de Venta
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                            Artículo
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                            Compañía de Envío
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                            Fecha Límite
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                            Estado
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                            Etiqueta
                          </th>

                        </tr>
                      </thead>
                      <tbody>
                        {pendingSales
                          .sort(
                            (a, b) =>
                              new Date(b.saleDate).getTime() -
                              new Date(a.saleDate).getTime()
                          )
                          .map((sale) => (
                            <tr
                              key={sale._id}
                              className="border-b border-gray-50 hover:bg-gray-50"
                            >
                              <td className="py-3 px-4">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  disabled={!sale.hasLabel}
                                  checked={selectedPending.has(sale._id)}
                                  onChange={() => toggleSelect(sale._id)}
                                />
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600">
                                {formatDate(sale.saleDate)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="max-w-xs">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {sale.itemName}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    #{sale.transactionId}
                                  </p>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                    carrierColors[sale.shippingCarrier] ||
                                    carrierColors.unknown
                                  }`}
                                >
                                  <Truck className="w-3 h-3" />
                                  {carrierNames[sale.shippingCarrier] ||
                                    sale.shippingCarrier}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm">
                                {sale.shippingDeadline
                                  ? formatDeadline(sale.shippingDeadline)
                                  : "-"}
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  <Clock className="w-3 h-3" />
                                  Pendiente
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                {sale.hasLabel ? (
                                  <button
                                    onClick={() => downloadLabel(sale._id)}
                                    disabled={downloadingLabel === sale._id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors disabled:opacity-50"
                                  >
                                    {downloadingLabel === sale._id ? (
                                      <span className="loading loading-spinner loading-xs"></span>
                                    ) : (
                                      <FileText className="w-3.5 h-3.5" />
                                    )}
                                    Descargar
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">
                                    No disponible
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Ventas Completadas Section */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div
                className="flex items-center justify-between p-4 border-b border-gray-100 cursor-pointer"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Ventas Completadas
                    </h2>
                    <p className="text-sm text-gray-500">
                      {completedSales.length} ventas finalizadas •{" "}
                      {formatCurrency(
                        completedSales.reduce((sum, s) => sum + (s.amount || 0), 0)
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Añadir Venta
                  </button>
                  {showCompleted ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {showCompleted && (
                <div className="overflow-x-auto">
                  {completedSales.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No hay ventas completadas</p>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="mt-3 text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Añadir venta manual
                      </button>
                    </div>
                  ) : (
                    <>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                              Fecha de Venta
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                              Artículo
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                              Coste
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                              Precio Venta
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                              Estado
                            </th>
                            <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedCompletedSales.map((sale) => (
                            <tr
                              key={sale._id}
                              className="border-b border-gray-50 hover:bg-gray-50"
                            >
                              <td className="py-3 px-4 text-sm text-gray-600">
                                {formatDate(sale.completedDate || sale.saleDate)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="max-w-xs">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {sale.itemName}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    #{sale.transactionId}
                                    {sale.isManual && (
                                      <button
                                        onClick={() => deleteSale(sale._id)}
                                        disabled={deletingSale === sale._id}
                                        className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                        title="Eliminar"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </p>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-500 text-right">
                                {sale.purchasePrice && sale.purchasePrice > 0
                                  ? formatCurrency(sale.purchasePrice)
                                  : "-"}
                              </td>
                              <td className="py-3 px-4 text-sm font-semibold text-emerald-600 text-right">
                                {formatCurrency(sale.amount || 0)}
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                  <CheckCircle className="w-3 h-3" />
                                  Completada
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                {sale.isManual || sale.status === "completed" ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => openEditModal(sale)}
                                      className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                      title="Editar"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteSale(sale._id)}
                                      disabled={deletingSale === sale._id}
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

                      {/* Pagination */}
                      {totalCompletedPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                          <p className="text-sm text-gray-500">
                            Mostrando {(completedPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                            {Math.min(completedPage * ITEMS_PER_PAGE, completedSales.length)} de{" "}
                            {completedSales.length} ventas
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setCompletedPage((p) => Math.max(1, p - 1))}
                              disabled={completedPage === 1}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              Anterior
                            </button>
                            <span className="text-sm text-gray-600">
                              Página {completedPage} de {totalCompletedPages}
                            </span>
                            <button
                              onClick={() =>
                                setCompletedPage((p) => Math.min(totalCompletedPages, p + 1))
                              }
                              disabled={completedPage === totalCompletedPages}
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
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Sale Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full pointer-events-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Añadir Nueva Venta
                </h3>
                <p className="text-sm text-gray-500">
                  Añade una venta manual a tu registro.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Artículo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSaleForm.itemName}
                  onChange={(e) =>
                    setNewSaleForm({ ...newSaleForm, itemName: e.target.value })
                  }
                  placeholder="Ej: Nike Air Max 95"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coste (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newSaleForm.purchasePrice}
                    onChange={(e) =>
                      setNewSaleForm({ ...newSaleForm, purchasePrice: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio de Venta (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newSaleForm.salePrice}
                    onChange={(e) =>
                      setNewSaleForm({ ...newSaleForm, salePrice: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Venta
                </label>
                <input
                  type="date"
                  value={newSaleForm.saleDate}
                  onChange={(e) =>
                    setNewSaleForm({ ...newSaleForm, saleDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddSale}
                disabled={addingSale || !newSaleForm.itemName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {addingSale ? (
                  <span className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-xs"></span>
                    Añadiendo...
                  </span>
                ) : (
                  "Añadir Venta"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Sale Modal */}
{/* Edit Sale Modal */}
{editingSale && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in fade-in zoom-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Editar Venta</h2>
        <button
          onClick={() => setEditingSale(null)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {/* Aviso para ventas de Gmail */}
        {!editingSale.isManual && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            ⚠️ Esta venta proviene de Gmail. Solo se puede modificar el coste.
          </div>
        )}

        {/* Nombre del artículo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del Artículo
          </label>
          <input
            type="text"
            value={editSaleForm.itemName}
            onChange={(e) =>
              setEditSaleForm({ ...editSaleForm, itemName: e.target.value })
            }
            disabled={!editingSale.isManual}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>

        {/* Coste (SIEMPRE editable) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Precio de Compra (€)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={editSaleForm.purchasePrice}
            onChange={(e) =>
              setEditSaleForm({
                ...editSaleForm,
                purchasePrice: e.target.value,
              })
            }
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Precio de venta */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Precio de Venta (€)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={editSaleForm.salePrice}
            onChange={(e) =>
              setEditSaleForm({
                ...editSaleForm,
                salePrice: e.target.value,
              })
            }
            disabled={!editingSale.isManual}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>

        {/* Fecha de venta */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha de Venta
          </label>
          <input
            type="date"
            value={editSaleForm.saleDate}
            onChange={(e) =>
              setEditSaleForm({
                ...editSaleForm,
                saleDate: e.target.value,
              })
            }
            disabled={!editingSale.isManual}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>

        {/* Estado */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estado
          </label>
          <select
            value={editSaleForm.status}
            onChange={(e) =>
              setEditSaleForm({
                ...editSaleForm,
                status: e.target.value as
                  | "pending"
                  | "completed"
                  | "cancelled",
              })
            }
            disabled={!editingSale.isManual}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="pending">Pendiente</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
        <button
          onClick={() => setEditingSale(null)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={updateSale}
          disabled={updatingSale}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {updatingSale ? "Actualizando..." : "Actualizar Venta"}
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}
