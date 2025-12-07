"use client";

import { useEffect, useState } from "react";
import {
  Eye,
  Download,
  Plus,
  Grid3X3,
  ChevronDown,
} from "lucide-react";
import MetricCard from "@/components/MetricCard";
import DateFilter, { type DateRange } from "@/components/DateFilter";
import apiClient from "@/libs/api";

interface EmailDetail {
  messageId: string;
  amount: number;
  date: string;
  snippet: string;
}

interface GmailData {
  total: number;
  count: number;
  weeklyTotal: number;
  weeklyCount: number;
  details: EmailDetail[];
}

// Interfaces para las métricas calculadas
interface SalesMetrics {
  ingresos: number;
  gananciaBruta: number;
  gananciaNeta: number;
  gastosTotal: number;
  comisiones: number;
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

export default function Dashboard() {
  const [gmailData, setGmailData] = useState<GmailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>("last3months");

  useEffect(() => {
    fetchGmailData();
  }, []);

  const fetchGmailData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get("/gmail");
      const data = response as unknown as GmailData;
      setGmailData(data);
    } catch (err: any) {
      console.error("Error fetching Gmail data:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Error al cargar los datos"
      );
    } finally {
      setLoading(false);
    }
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

  // Calcular métricas basadas en los datos
  const calculateMetrics = (): SalesMetrics => {
    if (!gmailData) {
      return {
        ingresos: 0,
        gananciaBruta: 0,
        gananciaNeta: 0,
        gastosTotal: 0,
        comisiones: 0,
        roi: 0,
        articulosVendidos: 0,
        valorPromedioOrden: 0,
      };
    }

    const ingresos = gmailData.total;
    const comisiones = ingresos * 0.05; // Estimando 5% de comisiones
    const gastosTotal = ingresos * 0.10; // Estimando 10% de gastos
    const gananciaBruta = ingresos - comisiones;
    const gananciaNeta = gananciaBruta - gastosTotal;
    const articulosVendidos = gmailData.count;
    const valorPromedioOrden = articulosVendidos > 0 ? ingresos / articulosVendidos : 0;
    const roi = gastosTotal > 0 ? ((gananciaNeta / gastosTotal) * 100) : 0;

    return {
      ingresos,
      gananciaBruta,
      gananciaNeta,
      gastosTotal,
      comisiones,
      roi,
      articulosVendidos,
      valorPromedioOrden,
    };
  };

  const calculateInsights = (): SalesInsights => {
    if (!gmailData) {
      return {
        diasPromedioListados: 0,
        descuentoPromedio: 0,
        descuentoPorcentaje: 0,
        tasaVenta: 0,
        listadosDiarios: 0,
        ventasDiarias: 0,
      };
    }

    const diasEnPeriodo = 90; // Últimos 3 meses
    const ventasDiarias = gmailData.count / diasEnPeriodo;
    const listadosDiarios = ventasDiarias * 1.2; // Estimación

    return {
      diasPromedioListados: 0,
      descuentoPromedio: -62.80,
      descuentoPorcentaje: -77.6,
      tasaVenta: gmailData.count > 0 ? (gmailData.count / (gmailData.count * 0.6)) * 100 : 0,
      listadosDiarios,
      ventasDiarias,
    };
  };

  const metrics = calculateMetrics();
  const insights = calculateInsights();

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
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Eye className="w-4 h-4" />
              Ver Items
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 rounded-lg text-sm font-medium text-white hover:bg-gray-800 transition-colors">
              <Plus className="w-4 h-4" />
              Agregar Item
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
          {/* Category Filters */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Categorías
              <ChevronDown className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Marketplaces
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Date Filters */}
        <div className="mb-8">
          <DateFilter
            selectedRange={selectedDateRange}
            onRangeChange={setSelectedDateRange}
          />
        </div>

        {loading && !gmailData ? (
          <div className="flex items-center justify-center py-20">
            <span className="loading loading-spinner loading-lg"></span>
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
            <button className="btn btn-sm" onClick={fetchGmailData}>
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
                tooltip="Ingresos menos comisiones"
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
                tooltip="Total de gastos operativos"
              />
            </div>

            {/* Secondary Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard
                title="Comisiones Totales"
                value={formatCurrency(metrics.comisiones)}
                valueColor="error"
                tooltip="Comisiones de plataformas"
              />
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
            </div>

            {/* Sales Insights Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Grid3X3 className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Estadísticas de Ventas
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <MetricCard
                  title="Días Promedio Listados - todo el tiempo"
                  value={insights.diasPromedioListados.toFixed(1)}
                  tooltip="Promedio de días que un artículo está listado antes de venderse"
                />
                <MetricCard
                  title="Descuento Promedio Dado"
                  value={`${formatCurrency(insights.descuentoPromedio)} · ${insights.descuentoPorcentaje}%`}
                  tooltip="Promedio de descuento aplicado en ventas"
                />
                <MetricCard
                  title="Tasa de Venta"
                  value={formatPercentage(insights.tasaVenta)}
                  tooltip="Porcentaje de artículos listados que se venden"
                />
                <MetricCard
                  title="Listados Diarios Promedio"
                  value={insights.listadosDiarios.toFixed(2)}
                  tooltip="Promedio de artículos listados por día"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard
                  title="Ventas Diarias Promedio"
                  value={insights.ventasDiarias.toFixed(2)}
                  tooltip="Promedio de ventas realizadas por día"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
