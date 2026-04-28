import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type DescribeMode = "normal" | "detail" | "read" | "money";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ description: "Método no permitido." });
  }

  try {
    const {
      image,
      mode = "normal",
      lastDescription = "",
    }: {
      image?: string;
      mode?: DescribeMode;
      lastDescription?: string;
    } = req.body;

    if (!image) {
      return res.status(200).json({
        description: "No se recibió ninguna imagen.",
      });
    }

    const isDetailMode = mode === "detail";
    const isReadMode = mode === "read";
    const isMoneyMode = mode === "money";

    const context = String(lastDescription || "").slice(0, 2200);
    const lowerContext = context.toLowerCase();

    const isStudyMode =
      lowerContext.includes("modo estudio") ||
      lowerContext.includes("estudia") ||
      lowerContext.includes("estudiar") ||
      lowerContext.includes("apuntes") ||
      lowerContext.includes("profesor");

    const isExplainMode =
      lowerContext.includes("modo explicación") ||
      lowerContext.includes("modo explicacion") ||
      lowerContext.includes("explica") ||
      lowerContext.includes("explicar") ||
      lowerContext.includes("para qué sirve") ||
      lowerContext.includes("para que sirve") ||
      lowerContext.includes("cómo funciona") ||
      lowerContext.includes("como funciona");

    const isAdviceMode =
      lowerContext.includes("modo consejo") ||
      lowerContext.includes("consejo práctico") ||
      lowerContext.includes("consejo practico") ||
      lowerContext.includes("dame un consejo") ||
      lowerContext.includes("aconsejame") ||
      lowerContext.includes("aconséjame") ||
      lowerContext.includes("qué hago") ||
      lowerContext.includes("que hago") ||
      lowerContext.includes("cómo lo mejoro") ||
      lowerContext.includes("como lo mejoro") ||
      lowerContext.includes("qué cambiarías") ||
      lowerContext.includes("que cambiarias") ||
      lowerContext.includes("está ordenado") ||
      lowerContext.includes("esta ordenado") ||
      lowerContext.includes("está limpio") ||
      lowerContext.includes("esta limpio");

    const isDeepMode =
      lowerContext.includes("responde con más contexto") ||
      lowerContext.includes("responde con mas contexto") ||
      lowerContext.includes("modo profundo") ||
      lowerContext.includes("profundo");

    const maxTokens =
      isStudyMode || isExplainMode || isAdviceMode
        ? isDeepMode
          ? 420
          : 260
        : isDetailMode || isReadMode
        ? 300
        : 170;

    const taskText = (() => {
      if (isStudyMode) {
        return `
Modo estudio.

Actúa como profesor claro y práctico.
No describas solo la imagen: ayuda a entenderla.

Si hay texto, apuntes, libro, pantalla, ejercicio o pizarra:
1. Di la idea principal.
2. Resume lo importante.
3. Explícalo fácil.
4. Da un ejemplo útil.
5. Si procede, añade una mini pregunta de repaso.

Si no hay contenido académico claro, explica lo visible de forma educativa.
Evita respuestas genéricas.
`.trim();
      }

      if (isAdviceMode) {
        return `
Modo consejo práctico.

NO hagas una descripción normal de la escena.
Primero entiende lo que se ve y después da consejos accionables.

Formato obligatorio:
1. Observación breve: una frase.
2. Consejo principal: qué haría primero.
3. Siguiente paso: una acción concreta.

Prioriza:
- seguridad
- orden
- limpieza
- comodidad
- organización
- utilidad diaria

Ejemplos:
- Si hay una mesa desordenada, di cómo ordenarla.
- Si hay comida, di si conviene guardarla, revisarla o limpiar.
- Si hay cables u obstáculos, prioriza seguridad.
- Si hay apuntes o documentos, sugiere leerlos, resumirlos o clasificarlos.
- Si está todo bien, dilo y sugiere una mejora pequeña.

No te limites a decir qué hay.
`.trim();
      }

      if (isExplainMode) {
        return `
Modo explicación.

No te limites a describir.
Explica qué es lo visible, para qué sirve, cómo se usa y qué debería saber una persona.

Formato recomendado:
1. Qué parece ser.
2. Para qué sirve.
3. Algo útil o curioso.
4. Si hay riesgo o detalle importante, dilo.

Usa ejemplos simples.
Si no estás seguro, dilo claramente.
`.trim();
      }

      if (isReadMode) {
        return `
Modo lectura.

Lee el texto visible y resume lo importante.
Prioriza:
- nombres
- fechas
- importes
- instrucciones
- advertencias
- medicamentos
- direcciones
- horarios
- pasos a seguir

Si el texto no se lee bien, dilo claramente.
No inventes palabras que no puedas leer.
`.trim();
      }

      if (isMoneyMode) {
        return `
Modo dinero.

Identifica si hay monedas o billetes.
Di el valor probable.
Si hay varias monedas o billetes, intenta sumar el total.
Si no estás seguro, dilo claramente.
No inventes valores.
`.trim();
      }

      if (isDetailMode) {
        return `
Modo detalle.

Dame más detalle útil sobre lo que tengo delante.
Evita repetir demasiado la descripción anterior.
Amplía solo lo que ayude.

Prioriza:
- objetos importantes
- posiciones
- texto visible
- obstáculos
- riesgos
- acciones recomendadas
`.trim();
      }

      return `
Modo mirar.

Analiza lo que tengo delante.
No hagas una descripción larga.
Dime qué hay, dónde está y si hay algo útil o importante.

Si hay texto visible, resume lo importante.
Si hay peligro cercano, avisa primero.
Si ves algo que conviene recordar, dilo de forma natural.
`.trim();
    })();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: maxTokens,
      temperature: 0.12,
      messages: [
        {
          role: "system",
          content: `
Eres ClaroVision, un asistente visual inteligente por voz.

Tu objetivo no es describir bonito.
Tu objetivo es ayudar a entender, actuar, estudiar, decidir y moverse con seguridad.

Sirves a:
- personas ciegas o con baja visión
- estudiantes
- personas mayores
- usuarios generales
- cualquiera que quiera entender mejor lo que tiene delante

Prioridad absoluta:
1. Seguridad: escaleras, bordes, tráfico, fuego, agua, cristales, obstáculos, cables, objetos en el suelo o personas muy cerca.
2. Texto útil: cartas, facturas, avisos, medicamentos, etiquetas, menús, pantallas, carteles, documentos, apuntes o libros.
3. Comprensión: explicar lo visible de forma útil, no solo nombrarlo.
4. Acción: decir qué conviene hacer después si aporta valor.
5. Orientación: puertas, caminos, mesas, sillas, objetos tocables, personas y posiciones.
6. Dinero: monedas, billetes e importes visibles.

Reglas estrictas:
- Responde SIEMPRE en español natural.
- Frases cortas.
- Sé claro, cercano y útil.
- No preguntes al usuario qué quiere hacer.
- No inventes.
- Si no estás seguro, di: "No estoy seguro, pero parece..."
- Si hay peligro cercano, empieza con: "Cuidado".
- Si hay texto visible relevante, empieza con: "Hay texto visible".
- Si hay texto pero no se lee bien, di: "Hay texto visible, pero no puedo leerlo con claridad".
- Usa posiciones útiles: delante, izquierda, derecha, centro, arriba, abajo, cerca, lejos.
- En modo normal: máximo 3 frases.
- En modo detalle, lectura, estudio, explicación o consejo: máximo 6 frases.
- En modo estudio: enseña, resume y simplifica.
- En modo explicación: añade utilidad, contexto y ejemplos.
- En modo consejo: NO describas sin más; da una recomendación accionable.
- En modo dinero: sé prudente y no inventes valores.
- Evita decir "en la imagen" todo el rato.
- Habla como un asistente útil, no como un informe técnico.
`.trim(),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `
Tarea:
${taskText}

Modo técnico actual: ${mode}

Contexto enviado por la app:
${context || "No hay contexto anterior."}

Importante:
- Si el contexto dice modo consejo, responde como consejo, no como descripción.
- Si el contexto dice modo estudio, responde como profesor.
- Si el contexto dice modo explicación, explica utilidad y contexto.
- Si el contexto contiene recuerdos recientes, úsalos solo como apoyo, no como verdad absoluta.
- Responde directamente.
`.trim(),
            },
            {
              type: "image_url",
              image_url: {
                url: image.startsWith("data:image")
                  ? image
                  : `data:image/jpeg;base64,${image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const description =
      response.choices[0]?.message?.content?.trim() ||
      "No he podido describir lo que tienes delante.";

    return res.status(200).json({ description });
  } catch (error: any) {
    console.error("ClaroVision describe error:", error);

    return res.status(500).json({
      description: error?.message || "Error desconocido en servidor.",
    });
  }
}