export const dynamic = "force-dynamic";

export default function ExpensesPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-8">Gastos</h1>
        <div className="bg-base-200 rounded-lg p-8">
          <p className="text-base-content/70">
            Esta es la página de gastos. Aquí podrás gestionar todos tus gastos.
          </p>
        </div>
      </div>
    </div>
  );
}

