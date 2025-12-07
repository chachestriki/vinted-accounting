"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Mail, Calendar, Euro } from "lucide-react";
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

export default function Dashboard() {
  const [gmailData, setGmailData] = useState<GmailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGmailData();
  }, []);

  const fetchGmailData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("🔄 Fetching Gmail data...");
      const response = await apiClient.get("/gmail");
      const data = response as unknown as GmailData;
      console.log("✅ Gmail API Response:", data);
      console.log("📊 Response type:", typeof data);
      console.log("📊 Response keys:", Object.keys(data || {}));
      console.log("📊 Weekly Total:", data?.weeklyTotal);
      console.log("📊 Total:", data?.total);
      console.log("📊 Weekly Count:", data?.weeklyCount);
      console.log("📊 Count:", data?.count);
      console.log("📊 Details length:", data?.details?.length);
      console.log("📊 Details:", data?.details);
      setGmailData(data);
    } catch (err: any) {
      console.error("❌ Error fetching Gmail data:", err);
      console.error("❌ Error response:", err?.response);
      console.error("❌ Error data:", err?.response?.data);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to fetch Gmail data"
      );
    } finally {
      setLoading(false);
      console.log("🏁 Loading finished");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  // Debug logging
  useEffect(() => {
    console.log("📈 Gmail Data State:", gmailData);
    console.log("⏳ Loading State:", loading);
    console.log("❌ Error State:", error);
  }, [gmailData, loading, error]);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-8">Dashboard</h1>

        {/* Gmail/Vinted Sales Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Ventas de Vinted</h2>
            <button
              className="btn btn-outline btn-sm"
              onClick={fetchGmailData}
              disabled={loading}
            >
              {loading ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                "Refresh"
              )}
            </button>
          </div>

          {loading && !gmailData ? (
            <div className="flex items-center justify-center py-12">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : error ? (
            <div className="alert alert-error">
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
              <div>
                <h3 className="font-bold">Error</h3>
                <div className="text-xs">{error}</div>
              </div>
            </div>
          ) : gmailData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Weekly Total */}
                <div className="card bg-primary text-primary-content">
                  <div className="card-body">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      <h3 className="card-title text-sm">Últimos 7 días</h3>
                    </div>
                    <p className="text-3xl font-bold">
                      {formatAmount(gmailData.weeklyTotal || 0)}
                    </p>
                    <p className="text-sm opacity-80">
                      {gmailData.weeklyCount || 0}{" "}
                      {gmailData.weeklyCount === 1 ? "venta" : "ventas"}
                    </p>
                  </div>
                </div>

                {/* Total */}
                <div className="card bg-base-200">
                  <div className="card-body">
                    <div className="flex items-center gap-2">
                      <Euro className="w-5 h-5" />
                      <h3 className="card-title text-sm">Total General</h3>
                    </div>
                    <p className="text-3xl font-bold">
                      {formatAmount(gmailData.total || 0)}
                    </p>
                    <p className="text-sm text-base-content/70">
                      {gmailData.count || 0}{" "}
                      {gmailData.count === 1 ? "venta" : "ventas"}
                    </p>
                  </div>
                </div>

                {/* Weekly Count */}
                <div className="card bg-base-200">
                  <div className="card-body">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      <h3 className="card-title text-sm">Esta Semana</h3>
                    </div>
                    <p className="text-3xl font-bold">
                      {gmailData.weeklyCount || 0}
                    </p>
                    <p className="text-sm text-base-content/70">transacciones</p>
                  </div>
                </div>

                {/* Total Count */}
                <div className="card bg-base-200">
                  <div className="card-body">
                    <div className="flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      <h3 className="card-title text-sm">Total Emails</h3>
                    </div>
                    <p className="text-3xl font-bold">{gmailData.count || 0}</p>
                    <p className="text-sm text-base-content/70">encontrados</p>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              {gmailData.details && gmailData.details.length > 0 ? (
                <div className="card bg-base-100 shadow-xl">
                  <div className="card-body">
                    <h3 className="card-title mb-4">Transacciones Recientes</h3>
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Monto</th>
                            <th>Detalles</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gmailData.details
                            .sort(
                              (a, b) =>
                                new Date(b.date).getTime() -
                                new Date(a.date).getTime()
                            )
                            .slice(0, 10)
                            .map((detail) => (
                              <tr key={detail.messageId}>
                                <td>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-base-content/50" />
                                    {formatDate(detail.date)}
                                  </div>
                                </td>
                                <td>
                                  <span className="font-semibold text-primary">
                                    {formatAmount(detail.amount)}
                                  </span>
                                </td>
                                <td>
                                  <div className="max-w-md truncate text-sm text-base-content/70">
                                    {detail.snippet}
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="alert alert-info">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-current shrink-0 w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <span>No se encontraron transacciones de Vinted.</span>
                </div>
              )}
            </>
          ) : (
            <div className="alert alert-warning">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>No hay datos disponibles. Haz clic en Refresh para cargar.</span>
            </div>
          )}
        </div>

        {/* Other Dashboard Content */}
        <div className="bg-base-200 rounded-lg p-8">
          <p className="text-base-content/70">
            Bienvenido a tu dashboard. Aquí podrás ver un resumen de tu actividad.
          </p>
        </div>
      </div>
    </div>
  );
}
