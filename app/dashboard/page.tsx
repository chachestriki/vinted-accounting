"use client";

import { useEffect, useState } from "react";
import {
  Eye,
  Download,
  Plus,
  Grid3X3,
  ChevronDown,
  RefreshCw,
  Calendar,
  Filter,
} from "lucide-react";
import MetricCard from "@/components/MetricCard";
import DateFilter, { type DateRange } from "@/components/DateFilter";
import SalesChart from "@/components/SalesChart";
import apiClient from "@/libs/api";

interface SaleStats {
  pending: { count: number; totalAmount: number };
  completed: { count: number; totalAmount: number };
  total: { count: number; totalAmount: number };
}

interface Sale {
  _id: string;
  transactionId: string;
  itemName: string;
  amount: number;
  status: string;
  shippingCarrier: string;
  saleDate: string;
  completedDate?: string;
}

interface SalesData {
  stats: SaleStats;
  sales: Sale[];
  total: number;
}

interface SalesMetrics {
  ingresos: number;
  gananciaBruta: number;
  gananciaNeta: number;
  gastosTotal: number;
  gastosOperativos: number;
  roi: number;
  articulosVendidos: number;
  valorPromedioOrden: number;
}

interface SalesInsights {
  diasPromedioListados: number;
  descuentoPromedio: number;
  descuentoPorcentaje: number;
  tasaVenta: number;
  listadosDiarios: number;
  ventasDiarias: number;
}

interface Expense {
  _id: string;
  type: string;
  description: string;
  amount: number;
  expenseDate: string;
}

interface ExpensesData {
  expenses: Expense[];
  total: number;
  stats: any;
}

export default function Dashboard() {
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [expensesData, setExpensesData] = useState<ExpensesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>("thisMonth");
  const [lastSync, setLastSync] = useState<string | null>(null);


  // Date picker personalizado
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (startDate?: string, endDate?: string) => {
    try {
      setLoading(true);
      setError(null);

      let queryParams = "";
      if (startDate) {
        queryParams += `&startDate=${new Date(startDate).toISOString()}`;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        queryParams += `&endDate=${end.toISOString()}`;
      }

      // Fetch sales and expenses in parallel
      const [salesRes, expensesRes] = await Promise.all([
        apiClient.get(`/sales?status=all${queryParams}`),
        apiClient.get(`/expenses?${queryParams.replace('&', '')}`)
      ]);

      setSalesData(salesRes as unknown as SalesData);
      setExpensesData(expensesRes as unknown as ExpensesData);
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      const errorMessage =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Error al cargar los datos";
      setError(typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage));
    } finally {
      setLoading(false);
    }
  };

  const syncSales = async (fullSync: boolean = false) => {
    try {
      setSyncing(true);
      setError(null);
      const res = await apiClient.post("/sync", { fullSync });

      // Si el servidor devolvió lastSync, lo guardamos
      if ((res as any).lastSync) {
        setLastSync((res as any).lastSync);
      }
      await fetchDashboardData();
    } catch (err: any) {
      console.error("Error syncing:", err);
      const errorMessage =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Error al sincronizar";
      setError(typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage));
    } finally {
      setSyncing(false);
    }
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
      fetchDashboardData(customStartDate, customEndDate);
    }
    setShowDatePicker(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Filtrar datos según el rango de fecha seleccionado
  const filterByDateRange = (items: any[], dateField: string): any[] => {
    if (!items) return [];

    // Si hay filtro personalizado activo, ya viene filtrado del servidor
    if (selectedDateRange === "custom" && (customStartDate || customEndDate)) {
      return items;
    }

    const now = new Date();
    let startDate: Date;

    switch (selectedDateRange) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "last7days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "last14days":
        startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "last3months":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "thisYear":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "allTime":
      default:
        return items;
    }

    return items.filter((item) => new Date(item[dateField]) >= startDate);
  };

  const filteredSales = salesData ? filterByDateRange(salesData.sales, 'saleDate') : [];
  const completedSales = filteredSales.filter(s => s.status === "completed");

  const filteredExpenses = expensesData ? filterByDateRange(expensesData.expenses, 'expenseDate') : [];

  const calculateMetrics = (): SalesMetrics => {
    if (!salesData || completedSales.length === 0) {
      return {
        ingresos: 0,
        gananciaBruta: 0,
        gananciaNeta: 0,
        gastosTotal: 0,
        gastosOperativos: 0,
        roi: 0,
        articulosVendidos: 0,
        valorPromedioOrden: 0,
      };
    }

    // 1. Ingresos Brutos (Total Sales Amount)
    const ingresos = completedSales.reduce((sum, s) => sum + (s.amount || 0), 0);

    // 2. Coste de Productos Vendidos (COGS) - Suma de purchasePrice de ventas completadas
    // Importante: 'productCost' aquí se refiere solo a los artículos que se han vendido en este periodo
    const costeProductos = completedSales.reduce((sum, s) => sum + ((s as any).purchasePrice || 0), 0);

    // 3. Gastos Operativos (Operating Expenses) - Suma de gastos Vinted (envíos, boosts, etc.)
    const gastosOperativos = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // 4. Ganancia Bruta = Ingresos - Coste de Productos
    const gananciaBruta = ingresos - costeProductos;

    // 5. Gastos Totales = Coste de Productos + Gastos Operativos
    const gastosTotal = costeProductos + gastosOperativos;

    // 6. Ganancia Neta = Ganancia Bruta - Gastos Operativos
    // O equivalentemente: Ingresos - Gastos Totales
    const gananciaNeta = gananciaBruta - gastosOperativos;

    // 7. ROI = (Ganancia Neta / Gastos Totales) * 100
    // Si no hubo gastos, el ROI es infinito o 0 según convención.
    const roi = gastosTotal > 0 ? ((gananciaNeta / gastosTotal) * 100) : 0;

    const articulosVendidos = completedSales.length;
    const valorPromedioOrden = articulosVendidos > 0 ? ingresos / articulosVendidos : 0;

    return {
      ingresos,
      gananciaBruta,
      gananciaNeta,
      gastosTotal, // Esto ahora incluye coste de producto + gastos operativos
      gastosOperativos, // Solo gastos de Vinted (armario + destacado)
      roi,
      articulosVendidos,
      valorPromedioOrden,
    };
  };

  const calculateInsights = (): SalesInsights => {
    if (!salesData || completedSales.length === 0) {
      return {
        diasPromedioListados: 0,
        descuentoPromedio: 0,
        descuentoPorcentaje: 0,
        tasaVenta: 0,
        listadosDiarios: 0,
        ventasDiarias: 0,
      };
    }

    const dates = completedSales.map(s => new Date(s.saleDate).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const diasEnPeriodo = Math.max(1, Math.ceil((maxDate - minDate) / (24 * 60 * 60 * 1000)));

    const ventasDiarias = completedSales.length / diasEnPeriodo;
    const listadosDiarios = ventasDiarias * 1.2;

    const pendingCount = filteredSales.filter(s => s.status === "pending").length;
    const totalFiltered = filteredSales.length;
    const tasaVenta = totalFiltered > 0 ? (completedSales.length / totalFiltered) * 100 : 0;

    return {
      diasPromedioListados: 0,
      descuentoPromedio: -62.80,
      descuentoPorcentaje: -77.6,
      tasaVenta,
      listadosDiarios,
      ventasDiarias,
    };
  };

  const metrics = calculateMetrics();
  const insights = calculateInsights();

  // Calculate chart data for sales per day
  const calculateSalesPerDay = () => {
    if (!filteredSales.length) return [];

    // Group sales by date with timestamp for proper sorting
    const salesByDate: { [key: string]: { value: number; timestamp: number } } = {};

    filteredSales.forEach((sale) => {
      const saleDate = new Date(sale.saleDate);
      const dateKey = saleDate.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
      });

      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = { value: 0, timestamp: saleDate.getTime() };
      }
      salesByDate[dateKey].value += 1;
    });

    return Object.entries(salesByDate)
      .map(([date, data]) => ({ date, value: data.value, timestamp: data.timestamp }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(({ date, value }) => ({ date, value }));
  };

  // Calculate chart data for revenue per day
  const calculateRevenuePerDay = () => {
    if (!completedSales.length) return [];

    // Group revenue by date with timestamp for proper sorting
    const revenueByDate: { [key: string]: { value: number; timestamp: number } } = {};

    completedSales.forEach((sale) => {
      const saleDate = new Date(sale.completedDate || sale.saleDate);
      const dateKey = saleDate.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
      });

      if (!revenueByDate[dateKey]) {
        revenueByDate[dateKey] = { value: 0, timestamp: saleDate.getTime() };
      }
      revenueByDate[dateKey].value += (sale.amount || 0);
    });

    return Object.entries(revenueByDate)
      .map(([date, data]) => ({ date, value: data.value, timestamp: data.timestamp }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(({ date, value }) => ({ date, value }));
  };

  const salesPerDayData = calculateSalesPerDay();
  const revenuePerDayData = calculateRevenuePerDay();

  const exportToCSV = () => {
    if (!completedSales.length) return;

    const headers = ["Fecha", "Artículo", "Monto"];
    const rows = completedSales.map(s => [
      new Date(s.saleDate).toLocaleDateString("es-ES"),
      s.itemName || "",
      (s.amount || 0).toFixed(2),
      s.transactionId || "",
      s.shippingCarrier || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ventas-vinted-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
              Reportes de Ventas
            </h1>
            <p className="text-gray-500">
              Información detallada sobre el rendimiento de tu negocio de reventa.
            </p>
            {salesData && (
              <p className="text-sm text-gray-400 mt-1">
                Total: {salesData.total} ventas • Mostrando: {filteredSales.length} ventas
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            {/* BOX DE ÚLTIMA SINCRONIZACIÓN */}
            {lastSync && (
              <div className="px-3 py-2 bg-gray-100/60 backdrop-blur-sm border border-gray-200 rounded-lg text-xs text-gray-600 shadow-sm">
                Última sincronización:
                <br />
                <span className="font-medium text-gray-800">
                  {new Date(lastSync).toLocaleString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg">
              <button
                onClick={() => syncSales(false)}
                disabled={syncing || loading}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 rounded-l-lg border-r border-gray-200"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className="p-2 hover:bg-gray-50 rounded-r-lg disabled:opacity-50" style={{ pointerEvents: syncing ? "none" : "auto" }}>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </div>
                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 border border-gray-100 mt-1">
                  <li>
                    <button onClick={() => syncSales(true)} className="text-gray-700">
                      Forzar Sincronización Completa
                    </button>
                  </li>
                </ul>
              </div>
            </div>
            <button
              onClick={exportToCSV}
              disabled={!completedSales.length}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>


        {/* Date Filters */}
        <div className="mb-6">
          <DateFilter
            selectedRange={selectedDateRange}
            onRangeChange={handleDateRangeChange}
          />
        </div>

        {/* Custom Date Picker */}
        {showDatePicker && (
          <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
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

        {/* Active Custom Filter Indicator */}
        {selectedDateRange === "custom" && (customStartDate || customEndDate) && (
          <div className="mb-6 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
            <Filter className="w-4 h-4" />
            <span>
              Mostrando ventas
              {customStartDate && ` desde ${formatDate(customStartDate)}`}
              {customEndDate && ` hasta ${formatDate(customEndDate)}`}
            </span>
            <button
              onClick={() => {
                setCustomStartDate("");
                setCustomEndDate("");
                setSelectedDateRange("allTime");
                fetchDashboardData();
              }}
              className="ml-auto text-blue-700 hover:text-blue-900 font-medium"
            >
              Limpiar
            </button>
          </div>
        )}

        {loading && !salesData ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="loading loading-spinner loading-lg mb-4"></span>
            <p className="text-gray-500">Cargando datos de ventas...</p>
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
            <button className="btn btn-sm" onClick={() => fetchDashboardData()}>
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {/* Main Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard
                title="Ingresos"
                value={formatCurrency(metrics.ingresos)}
                showChart
                trend="up"
                tooltip="Total de ingresos en el período seleccionado"
              />
              <MetricCard
                title="Ganancia Bruta"
                value={formatCurrency(metrics.gananciaBruta)}
                showChart
                trend="up"
                tooltip="Ingresos menos comisiones de plataforma"
              />
              <MetricCard
                title="Ganancia Neta"
                value={formatCurrency(metrics.gananciaNeta)}
                valueColor="success"
                showChart
                trend="up"
                tooltip="Ganancia después de todos los gastos"
              />
              <MetricCard
                title="Gastos Totales"
                value={formatCurrency(metrics.gastosTotal)}
                valueColor="error"
                showChart
                trend="down"
                tooltip="Total de gastos operativos (envío, materiales, etc.)"
              />
            </div>

            {/* Secondary Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard
                title="ROI"
                value={formatPercentage(metrics.roi)}
                tooltip="Retorno sobre la inversión"
              />
              <MetricCard
                title="Artículos Vendidos"
                value={metrics.articulosVendidos.toString()}
                tooltip="Cantidad total de artículos vendidos"
              />
              <MetricCard
                title="Valor Promedio de Orden"
                value={formatCurrency(metrics.valorPromedioOrden)}
                tooltip="Promedio de venta por artículo"
              />
              <MetricCard
                title="Gastos"
                value={formatCurrency(metrics.gastosOperativos)}
                valueColor="error"
                tooltip="Gastos operativos de Vinted (armario + destacados)"
              />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <SalesChart
                data={salesPerDayData}
                title="Ventas por Día"
                valueLabel="Ventas"
                color="#3b82f6"
                formatValue={(value) => value.toString()}
              />
              <SalesChart
                data={revenuePerDayData}
                title="Ingresos por Día"
                valueLabel="Ingresos"
                color="#10b981"
                formatValue={formatCurrency}
              />
            </div>

            {/* Quick Stats */}
            {salesData && (
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Resumen Rápido
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <p className="text-3xl font-bold text-amber-600">
                      {salesData.stats.pending.count}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Ventas Pendientes</p>
                  </div>
                  <div className="text-center p-4 bg-emerald-50 rounded-lg">
                    <p className="text-3xl font-bold text-emerald-600">
                      {salesData.stats.completed.count}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Ventas Completadas</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">
                      {formatCurrency(salesData.stats.completed.totalAmount)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Ingresos Totales</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
