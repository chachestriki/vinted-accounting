'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface SyncResult {
  success: boolean;
  message: string;
  stats?: {
    newEmails: number;
    salesAdded: number;
    expensesAdded: number;
    duration: number;
  };
  errors?: string[];
}

export default function SyncButton() {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (syncing) return;

    setSyncing(true);
    const loadingToast = toast.loading('Sincronizando con Gmail...');

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
      });

      const data: SyncResult = await response.json();

      if (data.success) {
        toast.success(
          `✅ Sincronización completa!\n${data.stats?.salesAdded || 0} ventas y ${data.stats?.expensesAdded || 0} gastos encontrados`,
          { id: loadingToast, duration: 5000 }
        );
        
        // Reload the page to show new data
        window.location.reload();
      } else {
        toast.error(
          data.message || 'Error en la sincronización',
          { id: loadingToast }
        );
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(
        'Error al sincronizar. Por favor intenta de nuevo.',
        { id: loadingToast }
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="btn btn-primary btn-sm gap-2"
    >
      {syncing ? (
        <>
          <span className="loading loading-spinner loading-sm"></span>
          Sincronizando...
        </>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          Sincronizar
        </>
      )}
    </button>
  );
}

