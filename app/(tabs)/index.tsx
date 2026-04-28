import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const DESCRIBE_URL = "https://clarovision-backend.vercel.app/api/describe";

type Mode = "normal" | "detail" | "read" | "money";

type Intent =
  | "wake"
  | "describe"
  | "read"
  | "money"
  | "detail"
  | "repeat"
  | "location"
  | "stop"
  | "help"
  | "memory"
  | "study"
  | "explain"
  | "advice"
  | "fast"
  | "deep"
  | "unknown";

type AppStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "capturing"
  | "speaking"
  | "error";

type Observation = {
  id: string;
  timestamp: number;
  mode: Mode | "study" | "explain" | "advice";
  userText?: string;
  result: string;
  tags: string[];
};

type ConversationState = {
  lastIntent: Intent | null;
  lastMode: Mode;
  lastUserText: string;
  lastAnswer: string;
};

async function describeImage(
  base64: string | undefined,
  mode: Mode = "normal",
  lastDescription = ""
) {
  if (!base64) return "No se pudo preparar la imagen.";

  try {
    const response = await fetch(DESCRIBE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64, mode, lastDescription }),
    });

    const data = await response.json();
    return data.description || "No se pudo obtener descripción.";
  } catch (error) {
    console.error(error);
    return "Error conectando con el servidor.";
  }
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;]/g, "")
    .trim();
}

function extractTags(text: string) {
  const clean = normalizeText(text);

  const usefulWords = clean
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .filter(
      (word) =>
        ![
          "esta",
          "este",
          "esto",
          "para",
          "como",
          "algo",
          "cerca",
          "sobre",
          "tiene",
          "puede",
          "donde",
          "delante",
          "parece",
          "imagen",
          "veo",
          "hay",
          "una",
          "unos",
          "unas",
          "con",
          "los",
          "las",
          "por",
          "que",
          "mas",
          "muy",
          "pero",
          "tambien",
        ].includes(word)
    );

  return Array.from(new Set(usefulWords)).slice(0, 12);
}

function detectIntent(command: string): Intent {
  const c = normalizeText(command);

  if (
    c.includes("calla") ||
    c.includes("silencio") ||
    c.includes("para de hablar") ||
    c === "para"
  )
    return "stop";

  if (
    c.includes("repite") ||
    c.includes("repetir") ||
    c.includes("otra vez") ||
    c.includes("dimelo otra vez")
  )
    return "repeat";

  if (
    c.includes("que habia antes") ||
    c.includes("que viste antes") ||
    c.includes("hace un momento") ||
    c.includes("que viste hace") ||
    c.includes("donde deje") ||
    c.includes("donde estan") ||
    c.includes("donde esta") ||
    c.includes("recuerdas") ||
    c.includes("lo anterior") ||
    c.includes("antes") ||
    c.includes("recuerda")
  )
    return "memory";

  if (
    c.includes("estudia") ||
    c.includes("modo estudio") ||
    c.includes("explicame esto") ||
    c.includes("resumeme") ||
    c.includes("hazme preguntas") ||
    c.includes("apuntes") ||
    c.includes("pizarra") ||
    c.includes("libro") ||
    c.includes("examen")
  )
    return "study";

  if (
    c.includes("para que sirve") ||
    c.includes("que es esto") ||
    c.includes("explicalo") ||
    c.includes("explica esto") ||
    c.includes("explicame") ||
    c.includes("como funciona")
  )
    return "explain";

  if (
    c.includes("que cambiarias") ||
    c.includes("esta ordenado") ||
    c.includes("esta limpio") ||
    c.includes("consejo") ||
    c.includes("aconsejame") ||
    c.includes("que hago") ||
    c.includes("como lo mejoro")
  )
    return "advice";

  if (
    c.includes("modo rapido") ||
    c.includes("respuesta corta") ||
    c.includes("rapido") ||
    c.includes("breve")
  )
    return "fast";

  if (
    c.includes("modo profundo") ||
    c.includes("profundo") ||
    c.includes("explica mejor") ||
    c.includes("con detalle")
  )
    return "deep";

  if (
    c.includes("mas detalle") ||
    c.includes("dame detalle") ||
    c.includes("amplia") ||
    c.includes("explica mas") ||
    c.includes("mas informacion") ||
    c === "mas"
  )
    return "detail";

  if (
    c.includes("donde estoy") ||
    c.includes("ubicacion") ||
    c.includes("localizacion") ||
    c.includes("mi posicion")
  )
    return "location";

  if (
    c.includes("lee") ||
    c.includes("leeme") ||
    c.includes("que pone") ||
    c.includes("texto") ||
    c.includes("documento") ||
    c.includes("carta") ||
    c.includes("factura") ||
    c.includes("etiqueta") ||
    c.includes("medicamento")
  )
    return "read";

  if (
    c.includes("moneda") ||
    c.includes("billete") ||
    c.includes("dinero") ||
    c.includes("cuanto dinero") ||
    c.includes("valor")
  )
    return "money";

  if (
    c.includes("que tengo delante") ||
    c.includes("que hay delante") ||
    c.includes("que ves") ||
    c.includes("describe") ||
    c.includes("describir") ||
    c.includes("analiza") ||
    c.includes("analizar") ||
    c.includes("mira") ||
    c.includes("mirar") ||
    c.includes("que hay aqui") ||
    c.includes("coche") ||
    c.includes("objeto") ||
    c.includes("persona") ||
    c.includes("obstaculo")
  )
    return "describe";

  if (c.includes("ayuda") || c.includes("que puedo decir") || c.includes("comandos"))
    return "help";

  if (
    c.includes("clarovision") ||
    c.includes("claro vision") ||
    c.includes("oye") ||
    c.includes("escucha") ||
    c.includes("hola") ||
    c.includes("asistente")
  )
    return "wake";

  return "unknown";
}

function isFollowUp(text: string) {
  const c = normalizeText(text);

  return (
    c === "y" ||
    c === "si" ||
    c === "vale" ||
    c === "mas" ||
    c.includes("y mas") ||
    c.includes("y eso") ||
    c.includes("continua") ||
    c.includes("sigue") ||
    c.includes("ahora lee") ||
    c.includes("y que pone") ||
    c.includes("y en detalle") ||
    c.includes("mas detalle") ||
    c.includes("explica mas")
  );
}

function buildPremiumInstruction(intent: Intent, qualityMode: "fast" | "deep") {
  const lengthRule =
    qualityMode === "fast"
      ? "Responde de forma breve, clara y directa. Máximo 2 frases."
      : "Responde con más contexto útil, pero sin enrollarte. Da detalles prácticos.";

  if (intent === "study") {
    return `${lengthRule}
Modo estudio: actúa como profesor. Si ves texto, apuntes, una pizarra o un libro, resume, explica la idea principal y da un ejemplo fácil.`;
  }

  if (intent === "explain") {
    return `${lengthRule}
Modo explicación: no te limites a describir. Explica qué es, para qué sirve, cómo se usa y qué debería saber una persona sobre eso.`;
  }

  if (intent === "advice") {
    return `${lengthRule}
Modo consejo práctico: da recomendaciones útiles sobre orden, limpieza, seguridad, organización o qué hacer con lo que ves. Sé concreto.`;
  }

  return `${lengthRule}
Sé cercano, útil y natural. Si ves algo importante para seguridad o uso diario, dilo.`;
}

function answerFromMemory(question: string, memory: Observation[]) {
  if (memory.length === 0) {
    return "Todavía no tengo recuerdos recientes. Mira algo primero y después podré recordarlo.";
  }

  const q = normalizeText(question);
  const questionWords = extractTags(q);

  const scored = memory
    .map((item) => {
      const resultText = normalizeText(item.result);
      const tagScore = item.tags.filter((tag) => q.includes(tag)).length * 3;
      const wordScore = questionWords.filter((word) => resultText.includes(word)).length;
      return { item, score: tagScore + wordScore };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  if (best && best.score > 0) {
    return `Hace un momento vi esto: ${best.item.result}`;
  }

  const last = memory[0];

  if (
    q.includes("antes") ||
    q.includes("hace un momento") ||
    q.includes("que viste") ||
    q.includes("lo anterior")
  ) {
    return `Lo último que recuerdo es: ${last.result}`;
  }

  return "No lo recuerdo con seguridad en las últimas observaciones. Puedo mirar otra vez ahora.";
}

export default function HomeScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [status, setStatus] = useState<AppStatus>("idle");
  const [cameraActive, setCameraActive] = useState(true);
  const [lastCaptureTime, setLastCaptureTime] = useState(0);
  const [lastImageBase64, setLastImageBase64] = useState<string | undefined>();
  const [lastMessage, setLastMessage] = useState("Pulsa Mirar o escribe lo que necesitas.");
  const [voiceText, setVoiceText] = useState("");
  const [typedCommand, setTypedCommand] = useState("");
  const [waitingCommand, setWaitingCommand] = useState(false);
  const [memory, setMemory] = useState<Observation[]>([]);
  const [qualityMode, setQualityMode] = useState<"fast" | "deep">("fast");
  const [smartHint, setSmartHint] = useState(
    "Puedes escribir: leer, estudiar, explicar, consejo, recordar o ubicación."
  );
  const [conversation, setConversation] = useState<ConversationState>({
    lastIntent: null,
    lastMode: "normal",
    lastUserText: "",
    lastAnswer: "",
  });

  const statusRef = useRef<AppStatus>("idle");
  const lastMessageRef = useRef(lastMessage);
  const lastImageRef = useRef<string | undefined>(undefined);
  const memoryRef = useRef<Observation[]>([]);
  const conversationRef = useRef(conversation);
  const qualityModeRef = useRef<"fast" | "deep">("fast");
  const handlingCommandRef = useRef(false);

  const isBusy = status === "capturing" || status === "thinking" || status === "speaking";

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    lastMessageRef.current = lastMessage;
  }, [lastMessage]);

  useEffect(() => {
    lastImageRef.current = lastImageBase64;
  }, [lastImageBase64]);

  useEffect(() => {
    memoryRef.current = memory;
  }, [memory]);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    qualityModeRef.current = qualityMode;
  }, [qualityMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!permission || !permission.granted) {
        requestPermission();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [permission, requestPermission]);

  const isBusyStatus = () => {
    return (
      statusRef.current === "capturing" ||
      statusRef.current === "thinking" ||
      statusRef.current === "speaking"
    );
  };

  const rememberObservation = (
    result: string,
    mode: Observation["mode"],
    userText?: string
  ) => {
    const item: Observation = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      mode,
      userText,
      result,
      tags: extractTags(`${userText || ""} ${result}`),
    };

    setMemory((prev) => [item, ...prev].slice(0, 5));
  };

  const stopEverything = () => {
    Speech.stop();
    setWaitingCommand(false);
    setStatus("idle");
  };

  const announce = (text: string) => {
    Speech.stop();
    Speech.speak(text, {
      language: "es-ES",
      rate: 0.92,
      pitch: 1,
    });
  };

  const speak = (text: string) => {
    Speech.stop();
    setLastMessage(text);
    setStatus("speaking");

    Speech.speak(text, {
      language: "es-ES",
      rate: 0.92,
      pitch: 1,
      onDone: () => setStatus("idle"),
      onStopped: () => setStatus("idle"),
      onError: () => setStatus("idle"),
    });
  };

  const startListening = async () => {
    speak(
      "En Expo Go el micrófono por voz no está disponible. Escribe comandos como estudiar, explicar, consejo, recordar, leer o describir."
    );
  };

  const pauseListening = () => {
    setStatus("idle");
  };

  const resolveConversationalIntent = (text: string, detected: Intent): Intent => {
    const c = normalizeText(text);

    if (!isFollowUp(text)) return detected;

    if (c.includes("lee") || c.includes("pone") || c.includes("texto")) return "read";
    if (c.includes("detalle") || c.includes("mas")) return "detail";
    if (c.includes("explica")) return "explain";

    return conversationRef.current.lastIntent || detected;
  };

  const getHintForIntent = (intent: Intent) => {
    if (intent === "study") return "Siguiente: escribe “hazme preguntas” o “resúmelo más”.";
    if (intent === "read") return "Siguiente: escribe “resúmelo”, “explícalo” o “más detalle”.";
    if (intent === "explain") return "Siguiente: escribe “más simple” o “dame un ejemplo”.";
    if (intent === "advice") return "Siguiente: escribe “qué hago primero” o “cómo lo mejoro”.";
    if (intent === "describe") return "Siguiente: escribe “más detalle”, “qué pone” o “recuérdalo”.";
    if (intent === "memory") return "Memoria activa. Puedes preguntar: “dónde estaba…”";
    return "Puedes escribir: leer, estudiar, explicar, consejo, recordar o ubicación.";
  };

  const handleVoiceCommand = async (text: string) => {
    if (handlingCommandRef.current) return;
    handlingCommandRef.current = true;

    try {
      let intent = detectIntent(text);
      intent = resolveConversationalIntent(text, intent);

      if (intent === "stop") {
        stopEverything();
        setLastMessage("Silencio.");
        return;
      }

      if (intent === "wake") {
        setWaitingCommand(true);
        speak("Te escucho. Escribe lo que necesitas.");
        return;
      }

      if (intent === "fast") {
        setQualityMode("fast");
        setSmartHint("Modo rápido: respuestas cortas y directas.");
        speak("Modo rápido activado. Responderé más breve.");
        return;
      }

      if (intent === "deep") {
        setQualityMode("deep");
        setSmartHint("Modo profundo: más contexto, ejemplos y utilidad.");
        speak("Modo profundo activado. Daré más contexto útil.");
        return;
      }

      if (intent === "unknown") {
        setWaitingCommand(false);
        speak(
          "No he entendido. Prueba con: mirar, leer, estudiar, explicar, consejo, recordar, dinero, detalle o ubicación."
        );
        return;
      }

      setWaitingCommand(false);
      setSmartHint(getHintForIntent(intent));

      if (intent === "repeat") {
        speak(lastMessageRef.current);
        return;
      }

      if (intent === "help") {
        speak(
          "Puedes escribir mirar, leer texto, estudiar, explicar, consejo, recordar lo anterior, dinero, detalle, ubicación, modo rápido o modo profundo."
        );
        return;
      }

      if (intent === "memory") {
        const answer = answerFromMemory(text, memoryRef.current);
        setConversation({
          lastIntent: "memory",
          lastMode: conversationRef.current.lastMode,
          lastUserText: text,
          lastAnswer: answer,
        });
        speak(answer);
        return;
      }

      if (intent === "location") {
        await getLocation();
        return;
      }

      if (intent === "detail") {
        await moreDetail(text);
        return;
      }

      if (intent === "read") {
        await captureAndAnalyze("read", text, "read");
        return;
      }

      if (intent === "money") {
        await captureAndAnalyze("money", text, "money");
        return;
      }

      if (intent === "study") {
        await captureAndAnalyze("read", text, "study");
        return;
      }

      if (intent === "explain") {
        await captureAndAnalyze("normal", text, "explain");
        return;
      }

      if (intent === "advice") {
        await captureAndAnalyze("normal", text, "advice");
        return;
      }

      if (intent === "describe") {
        await captureAndAnalyze("normal", text, "describe");
        return;
      }
    } finally {
      setTimeout(() => {
        handlingCommandRef.current = false;
      }, 700);
    }
  };

  const submitTypedCommand = () => {
    const text = typedCommand.trim();
    if (!text) return;

    setVoiceText(text);
    setTypedCommand("");
    handleVoiceCommand(text);
  };

  const captureAndAnalyze = async (
    mode: Mode,
    userText = "",
    intentForMemory: Observation["mode"] | Intent = mode
  ) => {
    const now = Date.now();

    if (now - lastCaptureTime < 2500) {
      speak("Espera un momento antes de volver a analizar.");
      return;
    }

    if (!cameraRef.current) {
      speak("La cámara no está lista.");
      return;
    }

    if (isBusyStatus()) return;

    try {
      pauseListening();

      setStatus("capturing");
      setLastCaptureTime(now);
      setLastMessage("Capturando.");

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
        skipProcessing: false,
      });

      setLastImageBase64(photo?.base64);
      setStatus("thinking");

      const detectedIntent =
        intentForMemory === "study" ||
        intentForMemory === "explain" ||
        intentForMemory === "advice"
          ? intentForMemory
          : detectIntent(userText);

      const premiumInstruction = buildPremiumInstruction(
        detectedIntent as Intent,
        qualityModeRef.current
      );

      const memoryContext =
        memoryRef.current.length > 0
          ? `Recuerdos recientes: ${memoryRef.current
              .map((m, i) => `${i + 1}. ${m.result}`)
              .join(" | ")}`
          : "Sin recuerdos recientes.";

      if (mode === "read") {
        setLastMessage("Leyendo.");
        announce("Leyendo.");
      } else if (mode === "money") {
        setLastMessage("Analizando dinero.");
        announce("Analizando dinero.");
      } else if (intentForMemory === "study") {
        setLastMessage("Estudiando imagen.");
        announce("Estudiando.");
      } else if (intentForMemory === "advice") {
        setLastMessage("Pensando consejo.");
        announce("Pensando consejo.");
      } else {
        setLastMessage("Analizando.");
        announce("Analizando.");
      }

      const description = await describeImage(
        photo?.base64,
        mode,
        `${premiumInstruction}
Pregunta del usuario: ${userText || "Sin pregunta concreta."}
Última respuesta: ${conversationRef.current.lastAnswer || lastMessageRef.current}
${memoryContext}`
      );

      const finalDescription = addHelpfulFollowUp(description, detectedIntent as Intent);

      rememberObservation(
        finalDescription,
        intentForMemory as Observation["mode"],
        userText
      );

      setConversation({
        lastIntent: detectedIntent as Intent,
        lastMode: mode,
        lastUserText: userText,
        lastAnswer: finalDescription,
      });

      setSmartHint(getHintForIntent(detectedIntent as Intent));
      speak(finalDescription);
    } catch (error) {
      console.error("Error capturando imagen:", error);
      speak("No se pudo analizar. Inténtalo otra vez.");
    }
  };

  const addHelpfulFollowUp = (text: string, intent: Intent) => {
    if (qualityModeRef.current === "fast") return text;

    if (intent === "study") {
      return `${text} Puedo hacerte preguntas para repasar.`;
    }

    if (intent === "explain") {
      return `${text} Puedo explicártelo más simple o con un ejemplo.`;
    }

    if (intent === "advice") {
      return `${text} Puedo ayudarte a decidir qué hacer primero.`;
    }

    if (intent === "describe") {
      return `${text} Puedo darte más detalle, leer texto o recordarlo por ti.`;
    }

    return text;
  };

  const moreDetail = async (userText = "más detalle") => {
    if (isBusyStatus()) return;

    if (!lastImageRef.current) {
      speak("Primero pulsa Mirar para poder ampliar detalles.");
      return;
    }

    try {
      pauseListening();

      setStatus("thinking");
      setLastMessage("Ampliando detalles.");
      announce("Ampliando detalles.");

      const memoryContext =
        memoryRef.current.length > 0
          ? memoryRef.current.map((m, i) => `${i + 1}. ${m.result}`).join(" | ")
          : "Sin recuerdos recientes.";

      const description = await describeImage(
        lastImageRef.current,
        "detail",
        `${buildPremiumInstruction("detail", qualityModeRef.current)}
Pregunta del usuario: ${userText}
Respuesta anterior: ${lastMessageRef.current}
Contexto reciente: ${memoryContext}`
      );

      rememberObservation(description, "detail", userText);

      setConversation({
        lastIntent: "detail",
        lastMode: "detail",
        lastUserText: userText,
        lastAnswer: description,
      });

      setSmartHint("Siguiente: escribe “qué pone”, “explícalo” o “recuérdalo”.");
      speak(description);
    } catch (error) {
      console.error("Error pidiendo más detalle:", error);
      speak("No pude ampliar la descripción.");
    }
  };

  const getLocation = async () => {
    if (isBusyStatus()) return;

    try {
      pauseListening();
      setStatus("thinking");

      const { status: locationStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (locationStatus !== "granted") {
        speak("No tengo permiso para acceder a la ubicación.");
        return;
      }

      setLastMessage("Buscando ubicación.");
      announce("Buscando ubicación.");

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = currentLocation.coords;

      let addressText = "";

      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        const address = addresses[0];

        if (address) {
          const street = address.street || "";
          const streetNumber = address.streetNumber || "";
          const city = address.city || address.subregion || "";
          const region = address.region || "";

          addressText = [street, streetNumber, city, region]
            .filter(Boolean)
            .join(", ");
        }
      } catch {
        addressText = "";
      }

      const msg = addressText
        ? `Estás cerca de ${addressText}.`
        : `Tu ubicación aproximada es latitud ${latitude.toFixed(
            4
          )}, longitud ${longitude.toFixed(4)}.`;

      rememberObservation(msg, "normal", "ubicación");

      setConversation({
        lastIntent: "location",
        lastMode: "normal",
        lastUserText: "ubicación",
        lastAnswer: msg,
      });

      setSmartHint("Ubicación guardada en memoria reciente.");
      speak(msg);
    } catch (error) {
      console.error(error);
      speak("No pude obtener la ubicación.");
    }
  };

  const getStatusText = () => {
    if (status === "listening") return "Te escucho";
    if (status === "capturing") return "Capturando";
    if (status === "thinking") return "Pensando";
    if (status === "speaking") return "Hablando";
    if (status === "error") return "Pulsa otra vez";
    if (waitingCommand) return "Esperando";
    return qualityMode === "fast" ? "ClaroVision · Rápido" : "ClaroVision · Profundo";
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logoLarge}
          accessible={false}
        />
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.text}>Preparando cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logoLarge}
          accessible={false}
        />

        <Text style={styles.title}>Permiso de cámara</Text>
        <Text style={styles.text}>
          ClaroVision necesita la cámara para ayudarte.
        </Text>

        <Pressable
          style={styles.bigButton}
          onPress={requestPermission}
          accessibilityRole="button"
          accessibilityLabel="Activar cámara"
        >
          <Text style={styles.bigButtonText}>Activar cámara</Text>
        </Pressable>
      </View>
    );
  }

  if (!cameraActive) {
    return (
      <View style={styles.center}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logoLarge}
          accessible={false}
        />

        <Text style={styles.text}>Cámara cerrada.</Text>

        <Pressable
          style={styles.bigButton}
          onPress={() => {
            setCameraActive(true);
            speak("Cámara activada.");
          }}
          accessibilityRole="button"
          accessibilityLabel="Activar cámara"
        >
          <Text style={styles.bigButtonText}>Activar cámara</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        autofocus="on"
      />

      <View style={styles.topOverlay} pointerEvents="none">
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
          accessible={false}
        />
        <Text style={styles.status}>{getStatusText()}</Text>
      </View>

      <View style={styles.bottomOverlay}>
        <View style={styles.messagePanel}>
          {!!voiceText && (
            <Text style={styles.voiceText} numberOfLines={1}>
              {voiceText}
            </Text>
          )}

          <Text style={styles.lastMessage} numberOfLines={2}>
            {lastMessage}
          </Text>

          <Text style={styles.smartHint} numberOfLines={1}>
            {smartHint}
          </Text>

          {memory.length > 0 && (
            <Text style={styles.memoryHint} numberOfLines={1}>
              Memoria · {memory.length}/5
            </Text>
          )}
        </View>

        <Pressable
          style={[styles.mainActionButton, isBusy && styles.disabled]}
          onPress={() => captureAndAnalyze("normal", "describe", "describe")}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Mirar y analizar entorno"
        >
          <Text style={styles.mainActionText}>Mirar</Text>
        </Pressable>

        <View style={styles.textCommandBox}>
          <TextInput
            style={styles.textInput}
            placeholder="Pide: leer, estudiar, explicar, consejo..."
            placeholderTextColor="#cbd5e1"
            value={typedCommand}
            onChangeText={setTypedCommand}
            onSubmitEditing={submitTypedCommand}
            returnKeyType="send"
            accessibilityLabel="Escribir comando"
          />

          <Pressable
            style={styles.sendButton}
            onPress={submitTypedCommand}
            accessibilityRole="button"
            accessibilityLabel="Enviar comando escrito"
          >
            <Text style={styles.sendButtonText}>Enviar</Text>
          </Pressable>
        </View>

        <View style={styles.compactActions}>
          <Pressable
            style={styles.compactButton}
            onPress={startListening}
            accessibilityRole="button"
            accessibilityLabel="Información de voz"
          >
            <Text style={styles.compactButtonText}>Voz</Text>
          </Pressable>

          <Pressable
            style={styles.compactButton}
            onPress={() => {
              const answer = answerFromMemory(
                "qué viste hace un momento",
                memoryRef.current
              );
              setSmartHint("Memoria consultada.");
              speak(answer);
            }}
            accessibilityRole="button"
            accessibilityLabel="Recordar lo anterior"
          >
            <Text style={styles.compactButtonText}>Recordar</Text>
          </Pressable>

          <Pressable
            style={styles.compactButton}
            onPress={() => {
              const next = qualityMode === "fast" ? "deep" : "fast";
              setQualityMode(next);
              setSmartHint(
                next === "fast"
                  ? "Modo rápido activo."
                  : "Modo profundo activo."
              );
              speak(
                next === "fast"
                  ? "Modo rápido activado."
                  : "Modo profundo activado."
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="Cambiar modo rápido o profundo"
          >
            <Text style={styles.compactButtonText}>
              {qualityMode === "fast" ? "Rápido" : "Profundo"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.stopButton}
            onPress={() => {
              stopEverything();
              setLastMessage("Silencio.");
            }}
            accessibilityRole="button"
            accessibilityLabel="Callar respuesta"
          >
            <Text style={styles.stopButtonText}>Callar</Text>
          </Pressable>
        </View>

        <View style={styles.hiddenUtilityRow}>
          <Pressable
            style={styles.utilityChip}
            onPress={() => handleVoiceCommand("ubicación")}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Dónde estoy"
          >
            <Text style={styles.utilityChipText}>Ubicación</Text>
          </Pressable>

          <Pressable
            style={styles.utilityChip}
            onPress={() => handleVoiceCommand("leer")}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Leer texto"
          >
            <Text style={styles.utilityChipText}>Leer</Text>
          </Pressable>

          <Pressable
            style={styles.utilityChip}
            onPress={() => handleVoiceCommand("estudiar")}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Modo estudiar"
          >
            <Text style={styles.utilityChipText}>Estudiar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },

  topOverlay: {
    position: "absolute",
    top: 42,
    left: 16,
    right: 16,
    alignItems: "center",
  },

  logo: {
    width: 54,
    height: 54,
    marginBottom: 6,
    resizeMode: "contain",
    borderRadius: 16,
  },

  logoLarge: {
    width: 190,
    height: 190,
    marginBottom: 22,
    resizeMode: "contain",
    borderRadius: 36,
  },

  status: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.58)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
  },

  bottomOverlay: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    alignItems: "center",
  },

  messagePanel: {
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.58)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },

  voiceText: {
    color: "#bbf7d0",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginBottom: 3,
    fontWeight: "800",
  },

  lastMessage: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "800",
  },

  smartHint: {
    marginTop: 4,
    color: "#c4b5fd",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "800",
  },

  memoryHint: {
    marginTop: 3,
    color: "#fde68a",
    fontSize: 11,
    textAlign: "center",
    fontWeight: "900",
  },

  mainActionButton: {
    width: "100%",
    minHeight: 64,
    borderRadius: 24,
    backgroundColor: "#fde047",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#000",
  },

  mainActionText: {
    color: "#000",
    fontSize: 27,
    fontWeight: "900",
  },

  disabled: {
    opacity: 0.6,
  },

  textCommandBox: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },

  textInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.9)",
    color: "#fff",
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 2,
    borderColor: "#94a3b8",
  },

  sendButton: {
    minWidth: 80,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#38bdf8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000",
  },

  sendButtonText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "900",
  },

  compactActions: {
    width: "100%",
    flexDirection: "row",
    gap: 7,
    marginTop: 8,
  },

  compactButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000",
  },

  compactButtonText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "900",
  },

  stopButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 15,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  stopButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },

  hiddenUtilityRow: {
    width: "100%",
    flexDirection: "row",
    gap: 7,
    marginTop: 7,
  },

  utilityChip: {
    flex: 1,
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },

  utilityChipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },

  center: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },

  title: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 20,
  },

  text: {
    color: "#fff",
    fontSize: 22,
    lineHeight: 32,
    textAlign: "center",
    marginBottom: 32,
  },

  bigButton: {
    width: "100%",
    minHeight: 100,
    borderRadius: 30,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: "#fde047",
  },

  bigButtonText: {
    color: "#000",
    fontSize: 30,
    fontWeight: "900",
  },
});