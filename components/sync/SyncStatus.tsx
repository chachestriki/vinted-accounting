'use client';

import { useEffect, useState } from 'react';

interface SyncStatus {
  syncing: boolean;
  lastSyncAt: string | null;
  totalSalesFound: number;
  totalExpensesFound: number;
  consecutiveErrors: number;
  lastSync: {
    status: string;
    duration: number;
    newEmails: number;
    salesAdded: number;
    expensesAdded: number;
    triggeredBy: string;
    completedAt: string;
  } | null;
}

export default function SyncStatus() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/sync/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-base-content/60">
        Cargando estado...
      </div>
    );
  }

  if (!status) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Hace menos de 1 minuto';
    if (diffMins < 60) return `Hace ${diffMins} minutos`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} horas`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} días`;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Sync Status Badge */}
      <div className="flex items-center gap-2">
        {status.syncing ? (
          <div className="badge badge-warning gap-2">
            <span className="loading loading-spinner loading-xs"></span>
            Sincronizando...
          </div>
        ) : status.consecutiveErrors > 0 ? (
          <div className="badge badge-error gap-2">
            ⚠️ Error en última sincronización
          </div>
        ) : (
          <div className="badge badge-success gap-2">
            ✓ Sincronizado
          </div>
        )}
      </div>

      {/* Last Sync Info */}
      <div className="text-sm text-base-content/60">
        <div>Última sincronización: {formatDate(status.lastSyncAt)}</div>
        
        {status.lastSync && (
          <div className="mt-1 text-xs">
            {status.lastSync.newEmails > 0 ? (
              <>
                {status.lastSync.salesAdded} ventas, {status.lastSync.expensesAdded} gastos ({status.lastSync.newEmails} emails)
              </>
            ) : (
              'Sin cambios'
            )}
          </div>
        )}
      </div>

      {/* Total Stats */}
      <div className="text-xs text-base-content/50">
        Total: {status.totalSalesFound} ventas, {status.totalExpensesFound} gastos
      </div>
    </div>
  );
}

