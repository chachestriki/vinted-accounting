import { PDFDocument, degrees, StandardFonts, rgb } from 'pdf-lib';

/**
 * Configure item name text position and style.
 * Measurements in points (1 inch = 72 pts).
 * Origin (0,0) is bottom-left of the page (before any page rotation).
 */
export const LABEL_FONT_SIZE = 10;

export const LABEL_TEXT_CONFIG = {
  inpost: {
    x: 180, // Right side of 6x4 page (becomes top of 4x6)
    y: 270,  // Bottom of 6x4 page (becomes right of 4x6)
    // To make it appear horizontal on the final vertical label:
    // Page is rotated -90 (CW).
    // Text needs to run "Up" (90 deg) in the original 6x4 space.
    rotation: -90
  },
  correos: {
    x: 40,
    y: 100,
    // Page is rotated -90. Vertical text requested.
    // 0 degree text on original page becomes vertical on rotated page.
    rotation: 0
  },
  seur: {
    x: 40,
    y: 20,
    // Page is standard 4x6 (Vertical). Vertical text requested.
    rotation: 90
  },
  vintedgo: {
    x: 20,
    y: 100,
    // Page is standard 4x6 (Vertical). Horizontal text requested.
    rotation: 0
  },
  default: {
    x: 20,
    y: 20,
    rotation: 0
  }
};

/**
 * Define el área de recorte en un PDF
 * Las coordenadas son en puntos (1 inch = 72 pts) desde la esquina inferior izquierda
 */
export interface CropRect {
  left: number;    // Distancia desde el borde izquierdo
  bottom: number;  // Distancia desde el borde inferior
  right: number;   // Distancia desde el borde izquierdo al borde derecho del recorte
  top: number;     // Distancia desde el borde inferior al borde superior del recorte
}

/**
 * Tipos de transportistas
 */
export type ShippingCarrier = "correos" | "inpost" | "seur" | "vintedgo" | "unknown";

/**
 * RECORTA (crop) un PDF a formato 4x6 pulgadas usando bounding boxes de embedPdf.
 * 
 * ¿Por qué usar embedPdf con bounding boxes?
 * -----------------------------------------------
 * - embedPdf con boundingBox REALMENTE recorta el contenido de la página original
 * - El bounding box define qué región extraer: [left, bottom, right, top]
 * - Esta es la ÚNICA forma en pdf-lib de hacer cropping real sin perder contenido
 * - Otros métodos (setCropBox, setSize) solo cambian el viewport pero no extraen contenido
 * 
 * COMPORTAMIENTO POR DEFECTO: Recorta 4x6 desde la esquina SUPERIOR IZQUIERDA
 * 
 * CASOS ESPECIALES POR TRANSPORTISTA:
 * - INPOST: Recorta 6x4 HORIZONTAL desde inferior izquierda (sin rotar)
 * - CORREOS: Solo rota 90° en sentido horario, sin recortar ni modificar contenido
 * - SEUR: Recorta 4x6 desde superior izquierda, desplazado 20 puntos a la derecha y 40 puntos abajo
 * - VINTEDGO: Recorta 4x6 desde superior izquierda (sin cambios)
 * 
 * @param pdfBuffer - Buffer del PDF original (típicamente A4: 595x842 pts)
 * @param cropRect - Opcional: región específica a recortar. Si no se proporciona, usa default por transportista
 * @param carrier - Opcional: transportista (determina el tipo de recorte y transformaciones)
 * @param itemName - Opcional: nombre del artículo para imprimir en la etiqueta
 * @returns Buffer del PDF recortado a 4x6 vertical
 */
export async function cropPdfTo4x6(
  pdfBuffer: Buffer,
  cropRect?: CropRect,
  carrier?: ShippingCarrier,
  itemName?: string
): Promise<Buffer> {
  // Dimensiones de 4x6 pulgadas en puntos (1 pulgada = 72 puntos)
  const TARGET_WIDTH = 4 * 72;   // 288 puntos
  const TARGET_HEIGHT = 6 * 72;  // 432 puntos

  // Cargar el PDF original
  const srcDoc = await PDFDocument.load(pdfBuffer);

  // Crear un nuevo documento para el resultado
  const destDoc = await PDFDocument.create();

  // Embed standard font if item name is provided
  let font;
  if (itemName) {
    font = await destDoc.embedFont(StandardFonts.Helvetica);
  }

  // CASO ESPECIAL: INPOST requiere 6x4 horizontal que luego se rota 90° a 4x6 vertical
  const isInpost = carrier?.toLowerCase() === 'inpost';
  const isCorreos = carrier?.toLowerCase() === 'correos';
  const isSeur = carrier?.toLowerCase() === 'seur';

  // Configuración de texto para este carrier
  // Evitar problemas de tipos accediendo de forma segura
  const carrierKey = carrier as keyof typeof LABEL_TEXT_CONFIG;
  const textConfig = (carrierKey && LABEL_TEXT_CONFIG[carrierKey])
    ? LABEL_TEXT_CONFIG[carrierKey]
    : LABEL_TEXT_CONFIG.default;

  // Procesar cada página del PDF original
  for (let i = 0; i < srcDoc.getPageCount(); i++) {
    const srcPage = srcDoc.getPage(i);
    const { width: srcWidth, height: srcHeight } = srcPage.getSize();

    // CORREOS: Solo rotar, sin recortar ni modificar contenido
    if (isCorreos) {
      const [embeddedPage] = await destDoc.embedPdf(srcDoc, [i]);

      // Crear página con las mismas dimensiones del original
      const page = destDoc.addPage([srcWidth, srcHeight]);

      // Dibujar la página completa sin modificaciones
      page.drawPage(embeddedPage, {
        x: 0,
        y: 0,
        width: srcWidth,
        height: srcHeight,
      });

      // Imprimir nombre del artículo si existe
      if (itemName && font) {
        page.drawText(itemName, {
          x: textConfig.x,
          y: textConfig.y,
          size: LABEL_FONT_SIZE,
          font: font,
          color: rgb(0, 0, 0),
          rotate: degrees(textConfig.rotation),
        });
      }

      // Rotar 90° en sentido horario
      page.setRotation(degrees(-90));

      continue; // Saltar al siguiente ciclo
    }

    // Determinar cropRect según el transportista
    let rect: CropRect;

    if (cropRect) {
      // Si se proporciona explícitamente, usar ese
      rect = cropRect;
    } else if (isInpost) {
      // INPOST: Recortar 6x4 (432x288 pts) desde INFERIOR IZQUIERDA con márgenes ajustados
      // Márgenes para evitar cortar la etiqueta:
      // - 30 pts desde la izquierda (aprox 0.42 pulgadas)
      // - 50 pts desde abajo (aprox 0.69 pulgadas)
      const leftMargin = 75;
      const bottomMargin = 35;

      rect = {
        left: leftMargin,
        bottom: bottomMargin,
        right: leftMargin + TARGET_HEIGHT,   // 30 + 432 = 462 pts
        top: bottomMargin + TARGET_WIDTH,    // 50 + 288 = 338 pts
      };
    } else if (isSeur) {
      // SEUR: Recortar 4x6 desde SUPERIOR IZQUIERDA, desplazado 20 puntos a la derecha y 15 puntos abajo
      rect = {
        left: 20,  // Mover 20 puntos a la derecha
        bottom: srcHeight - TARGET_HEIGHT - 40,  // Mover 15 puntos hacia abajo
        right: 20 + TARGET_WIDTH,
        top: srcHeight - 40,  // Mover 15 puntos hacia abajo
      };
    } else {
      // DEFAULT: Recortar 4x6 desde SUPERIOR IZQUIERDA
      rect = {
        left: 0,
        bottom: srcHeight - TARGET_HEIGHT,
        right: TARGET_WIDTH,
        top: srcHeight,
      };
    }

    if (isInpost) {
      // ===== INPOST: RECORTE 6x4 HORIZONTAL DESDE INFERIOR IZQUIERDA =====
      // 
      // InPost usa etiquetas 6x4 pulgadas (432x288 pts) en formato HORIZONTAL
      // Se recorta desde la esquina inferior izquierda con márgenes optimizados

      const [embeddedPage] = await destDoc.embedPdf(srcDoc, [i]);

      const cropWidth = rect.right - rect.left;   // 432 pts (6")
      const cropHeight = rect.top - rect.bottom;  // 288 pts (4")

      // Crear página 6x4 HORIZONTAL
      const page = destDoc.addPage([TARGET_HEIGHT, TARGET_WIDTH]); // 432x288 = 6x4

      // Calcular escala para el cropping
      const scaleX = TARGET_HEIGHT / cropWidth;
      const scaleY = TARGET_WIDTH / cropHeight;

      // Dibujar el contenido recortado desde inferior izquierda
      page.drawPage(embeddedPage, {
        x: -rect.left * scaleX,
        y: -rect.bottom * scaleY,
        width: srcWidth * scaleX,
        height: srcHeight * scaleY,
      });

      // Imprimir nombre del artículo si existe (antes de rotar la página)
      if (itemName && font) {
        page.drawText(itemName, {
          x: textConfig.x,
          y: textConfig.y,
          size: LABEL_FONT_SIZE,
          font: font,
          color: rgb(0, 0, 0),
          rotate: degrees(textConfig.rotation),
        });
      }

      // Rotar 90° en sentido antihorario para que quede vertical (4x6)
      page.setRotation(degrees(-90));

    } else {
      // ===== OTROS TRANSPORTISTAS: MÉTODO NORMAL CON EMBEDPDF =====

      const [embeddedPage] = await destDoc.embedPdf(srcDoc, [i]);

      // Obtener dimensiones del área que queremos recortar
      const cropWidth = rect.right - rect.left;
      const cropHeight = rect.top - rect.bottom;

      // Crear página 4x6 vertical
      const page = destDoc.addPage([TARGET_WIDTH, TARGET_HEIGHT]);

      // CROPPING normal desde superior izquierda
      const scaleX = TARGET_WIDTH / cropWidth;
      const scaleY = TARGET_HEIGHT / cropHeight;

      page.drawPage(embeddedPage, {
        x: -rect.left * scaleX,
        y: -rect.bottom * scaleY,
        width: srcWidth * scaleX,
        height: srcHeight * scaleY,
      });

      // Imprimir nombre del artículo si existe
      if (itemName && font) {
        page.drawText(itemName, {
          x: textConfig.x,
          y: textConfig.y,
          size: LABEL_FONT_SIZE,
          font: font,
          color: rgb(0, 0, 0),
          rotate: degrees(textConfig.rotation),
        });
      }
    }
  }

  // Guardar y retornar el PDF recortado
  const pdfBytes = await destDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Convierte un PDF de base64url (formato Gmail) a 4x6 pulgadas mediante cropping
 * 
 * @param base64urlData - Datos en formato base64url de Gmail
 * @param cropRect - Opcional: región específica a recortar
 * @param carrier - Opcional: transportista (determina el tipo de recorte y transformaciones)
 * @param itemName - Opcional: nombre del artículo para imprimir en la etiqueta
 * @returns Buffer del PDF recortado a 4x6 vertical
 */
export async function convertBase64UrlPdfTo4x6(
  base64urlData: string,
  cropRect?: CropRect,
  carrier?: ShippingCarrier,
  itemName?: string
): Promise<Buffer> {
  // Convertir base64url a base64
  const base64 = base64urlData.replace(/-/g, '+').replace(/_/g, '/');
  const buffer = Buffer.from(base64, 'base64');

  // Recortar el PDF a 4x6 (con tratamiento especial para InPost)
  return await cropPdfTo4x6(buffer, cropRect, carrier, itemName);
}

/**
 * EJEMPLOS DE cropRect PARA DIFERENTES CASOS (página A4: 595x842 pts):
 * 
 * 1. DEFAULT - Esquina superior izquierda 4x6 vertical:
 *    No especificar cropRect o usar:
 *    { left: 0, bottom: 410, right: 288, top: 842 }
 * 
 * 2. INPOST - Esquina inferior izquierda 6x4 horizontal (con márgenes):
 *    Automático con carrier="inpost":
 *    { left: 75, bottom: 35, right: 507, top: 323 }
 * 
 * 3. Etiqueta centrada en A4 (4x6):
 *    { left: 153.5, bottom: 205, right: 441.5, top: 637 }
 * 
 * 4. Esquina superior derecha (4x6):
 *    { left: 307, bottom: 410, right: 595, top: 842 }
 * 
 * 5. Esquina inferior izquierda (4x6):
 *    { left: 0, bottom: 0, right: 288, top: 432 }
 * 
 * 6. Esquina inferior derecha (4x6):
 *    { left: 307, bottom: 0, right: 595, top: 432 }
 */
