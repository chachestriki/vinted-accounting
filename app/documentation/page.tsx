import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface DocSection {
  id: string;
  title: string;
  description: string;
  points: string[];
  screenshotHint: string;
}

const docSections: DocSection[] = [
  {
    id: "primeros-pasos",
    title: "Primeros pasos",
    description: "Qué hace la aplicación y cómo empezar a usarla en el día a día.",
    points: [
      "La app centraliza ventas, inventario, gastos y etiquetado de envíos en un solo panel.",
      "El flujo recomendado es: sincronizar correos, revisar ventas pendientes y descargar etiquetas.",
      "Las secciones principales son Dashboard, Ventas, Inventario, Gastos y Ajustes.",
      "Puedes registrar movimientos manuales cuando no vengan desde el correo.",
    ],
    screenshotHint: "Añadir captura del menú lateral y vista general del panel principal.",
  },
  {
    id: "resumen-panel",
    title: "Resumen del panel",
    description: "Métricas globales y seguimiento de rendimiento desde Dashboard.",
    points: [
      "Muestra KPIs de ingresos, ganancia bruta/neta, ROI y volumen de ventas.",
      "Incluye filtros por rango de fechas para comparar periodos rápidamente.",
      "Combina datos de ventas y gastos para calcular resultados reales.",
      "Permite lanzar sincronización de datos sin salir del panel.",
    ],
    screenshotHint: "Añadir captura de métricas y gráfica de evolución en Dashboard.",
  },
  {
    id: "ventas",
    title: "Módulo de ventas",
    description: "Gestión de ventas pendientes y completadas, con edición manual.",
    points: [
      "Separa ventas pendientes de envío y ventas completadas.",
      "Permite crear, editar y eliminar ventas manuales cuando sea necesario.",
      "Incluye vinculación/desvinculación de ventas con bundles del inventario.",
      "Desde pendientes, puedes descargar etiqueta individual o varias combinadas.",
    ],
    screenshotHint: "Añadir captura de la tabla de ventas pendientes y el botón de descarga.",
  },
  {
    id: "inventario",
    title: "Módulo de inventario",
    description: "Control de bundles, stock disponible y métricas de rentabilidad.",
    points: [
      "Permite crear y editar bundles con proveedor, precio y cantidad.",
      "Calcula datos útiles como coste por unidad y retorno estimado.",
      "Muestra estado del stock para apoyar la planificación de compras.",
      "Al eliminar un bundle, las ventas vinculadas se desvinculan automáticamente.",
    ],
    screenshotHint: "Añadir captura del listado de bundles y del modal de alta/edición.",
  },
  {
    id: "gastos",
    title: "Módulo de gastos",
    description: "Seguimiento de gastos de Vinted y gastos manuales con filtros.",
    points: [
      "Gestiona gastos por tipo (armario/destacado) y por rango de fechas.",
      "Permite registrar gastos manuales y también editar o eliminar existentes.",
      "Incluye paginación para facilitar revisión de histórico.",
      "Los importes se integran con Dashboard para métricas de beneficio neto.",
    ],
    screenshotHint: "Añadir captura de filtros por fecha/tipo y listado de gastos.",
  },
  {
    id: "flujo-etiquetas",
    title: "Flujo de etiquetas de envío",
    description: "Obtención y transformación de etiquetas según transportista.",
    points: [
      "Las etiquetas se obtienen desde correos asociados a ventas pendientes.",
      "La descarga puede ser individual o combinada en un único PDF.",
      "Se aplican transformaciones específicas por transportista (rotación/recorte/desplazamiento).",
      "La lógica de procesamiento está centralizada en el flujo de generación de PDF.",
    ],
    screenshotHint: "Añadir captura del resultado final de etiquetas por transportista.",
  },
  {
    id: "integraciones",
    title: "Integraciones",
    description: "Sincronización automática y servicios conectados.",
    points: [
      "La sincronización principal procesa correos de ventas y gastos desde Gmail.",
      "Se guarda estado de última sincronización para evitar duplicados.",
      "El sistema actualiza ventas existentes y crea nuevas según transacciones detectadas.",
      "También sincroniza gastos de promoción y permite full sync cuando se necesita.",
    ],
    screenshotHint: "Añadir captura del estado de sincronización y resultado del proceso.",
  },
  {
    id: "ajustes",
    title: "Ajustes",
    description: "Espacio de configuración y preferencias de cuenta.",
    points: [
      "Página destinada a centralizar configuraciones del usuario y de la app.",
      "Actualmente muestra base informativa y está preparada para ampliación.",
      "Se recomienda usar esta sección para futuras opciones de personalización.",
    ],
    screenshotHint: "Añadir captura de la pantalla de ajustes actual.",
  },
  {
    id: "faq",
    title: "FAQ",
    description: "Preguntas comunes para soporte y operación.",
    points: [
      "¿Qué hacer si no aparece una venta? Ejecutar sincronización y revisar filtros de fecha.",
      "¿Qué hacer si no hay etiqueta? Verificar que el correo de envío tenga adjunto PDF.",
      "¿Se puede trabajar manualmente? Sí, ventas y gastos permiten alta/edición manual.",
      "¿Por qué cambian los números del panel? Se recalculan al sincronizar o al editar datos.",
    ],
    screenshotHint: "Añadir captura de una sección de ayuda o preguntas frecuentes.",
  },
];

export default function DocumentationPage() {
  return (
    <>
      <Suspense>
        <Header />
      </Suspense>

      <main className="bg-base-100">
        <section className="container mx-auto px-6 py-10 lg:py-14">
          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-extrabold">Documentación</h1>
            <p className="mt-2 text-base-content/70">
              Ventana de documentación mock. Puedes reemplazar todo el texto y agregar imágenes después.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="card bg-base-200">
                <div className="card-body p-4">
                  <h2 className="font-semibold text-sm uppercase tracking-wide text-base-content/70">
                    Secciones
                  </h2>
                  <nav aria-label="Secciones de documentación" className="mt-3">
                    <ul className="flex flex-col gap-2">
                      {docSections.map((section) => (
                        <li key={section.id}>
                          <a
                            href={`#${section.id}`}
                            className="link link-hover text-sm text-base-content"
                          >
                            {section.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
              </div>
            </aside>

            <div className="space-y-6">
              {docSections.map((section) => (
                <section id={section.id} key={section.id} className="card bg-base-200 scroll-mt-24">
                  <div className="card-body">
                    <h3 className="card-title text-2xl">{section.title}</h3>
                    <p className="text-base-content/70">{section.description}</p>
                    <ul className="mt-2 space-y-2 text-sm text-base-content/80 list-disc pl-5">
                      {section.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                    <div className="mt-4 rounded-lg border border-dashed border-base-content/20 p-4 text-sm text-base-content/60">
                      <span className="font-semibold">Captura sugerida:</span> {section.screenshotHint}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
