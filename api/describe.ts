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

    const maxTokens = isDetailMode || isReadMode ? 280 : 160;

    const taskText = (() => {
      if (isReadMode) {
        return `
Lee el texto visible y resume lo importante.
Prioriza nombres, fechas, importes, instrucciones, advertencias, medicamentos, direcciones, horarios y pasos a seguir.
Si el texto no se lee bien, dilo claramente.
`.trim();
      }

      if (isMoneyMode) {
        return `
Identifica si hay monedas o billetes.
Di el valor probable.
Si no estás seguro, dilo.
No inventes valores.
`.trim();
      }

      if (isDetailMode) {
        return `
Dame más detalle útil sobre lo que tengo delante.
Si hay texto, amplía fechas, importes, nombres, instrucciones y avisos.
Si hay objetos u obstáculos, explica dónde están y qué debo tener en cuenta.
Evita repetir demasiado la descripción anterior.
`.trim();
      }

      return `
Analiza lo que tengo delante.
Si hay texto, resume lo importante.
Si no hay texto, dime qué hay, dónde está y si debo tener cuidado.
`.trim();
    })();

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: maxTokens,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `
Eres ClaroVision, un asistente visual por voz para una persona ciega o con baja visión.

Tu objetivo NO es describir bonito.
Tu objetivo es ayudar a actuar con seguridad, rapidez y claridad.

Prioridad absoluta:
1. Peligros: escaleras, bordes, tráfico, fuego, agua, cristales, obstáculos, cables, objetos en el suelo o personas muy cerca.
2. Texto útil: cartas, facturas, avisos, medicamentos, etiquetas, menús, pantallas, carteles, documentos.
3. Dinero: monedas, billetes, importes visibles.
4. Orientación: puertas, caminos, mesas, sillas, objetos tocables, personas y posiciones.
5. Detalles secundarios solo si ayudan.

Reglas estrictas:
- Responde SIEMPRE en español natural.
- Frases cortas.
- No preguntes al usuario qué quiere hacer.
- No inventes.
- Si no estás seguro, di: "No estoy seguro, pero parece..."
- Si hay peligro cercano, empieza con: "Cuidado".
- Si hay texto visible, empieza con: "Hay texto visible".
- Si hay texto pero no se lee bien, di: "Hay texto visible, pero no puedo leerlo con claridad".
- Usa posiciones útiles: delante, izquierda, derecha, centro, arriba, abajo, cerca, lejos.
- En modo normal: máximo 3 frases.
- En modo detalle o lectura: máximo 6 frases.
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

Modo actual: ${mode}

Descripción anterior:
${lastDescription || "No hay descripción anterior."}

Responde directamente.
`.trim(),
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${image}`,
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
  } catch (error) {
    console.error("ClaroVision describe error:", error);

    return res.status(200).json({
      description: "No he podido analizarlo. Inténtalo otra vez.",
    });
  }
}