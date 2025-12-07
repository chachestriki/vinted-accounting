export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-8">Settings</h1>
        <div className="bg-base-200 rounded-lg p-8">
          <p className="text-base-content/70">
            Esta es la página de configuración. Aquí podrás ajustar las preferencias de tu cuenta.
          </p>
        </div>
      </div>
    </div>
  );
}

