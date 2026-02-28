import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface DocSection {
  id: string;
  title: string;
  description: string;
}

const docSections: DocSection[] = [
  {
    id: "primeros-pasos",
    title: "Primeros pasos",
    description: "Resumen de configuración inicial y primeros pasos.",
  },
  {
    id: "instalacion",
    title: "Instalación",
    description: "Cómo instalar y configurar el proyecto.",
  },
  {
    id: "resumen-panel",
    title: "Resumen del panel",
    description: "Áreas principales del producto y para qué sirve cada una.",
  },
  {
    id: "flujo-etiquetas",
    title: "Flujo de etiquetas de envío",
    description: "Proceso para generar, transformar y descargar etiquetas.",
  },
  {
    id: "integraciones",
    title: "Integraciones",
    description: "Servicios externos y puntos de conexión.",
  },
  {
    id: "faq",
    title: "FAQ",
    description: "Preguntas frecuentes y respuestas.",
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
                    <div className="mt-2 rounded-lg border border-dashed border-base-content/20 p-4 text-sm text-base-content/60">
                      Bloque de contenido de ejemplo. Agrega aquí tu texto final, capturas, diagramas y ejemplos.
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
