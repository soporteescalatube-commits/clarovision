import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const BACKEND_BASE_URL = "https://clarovision-backend.vercel.app";
const DESCRIBE_URL = `${BACKEND_BASE_URL}/api/describe`;

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
  | "unknown";

type AppStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "capturing"
  | "speaking"
  | "error";

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

function detectIntent(command: string): Intent {
  const c = normalizeText(command);

  if (
    c.includes("calla") ||
    c.includes("silencio") ||
    c.includes("para de hablar") ||
    c === "para"
  ) {
    return "stop";
  }

  if (
    c.includes("repite") ||
    c.includes("repetir") ||
    c.includes("otra vez") ||
    c.includes("dimelo otra vez")
  ) {
    return "repeat";
  }

  if (
    c.includes("mas detalle") ||
    c.includes("dame detalle") ||
    c.includes("amplia") ||
    c.includes("explica mas") ||
    c.includes("mas informacion")
  ) {
    return "detail";
  }

  if (
    c.includes("donde estoy") ||
    c.includes("ubicacion") ||
    c.includes("localizacion") ||
    c.includes("mi posicion")
  ) {
    return "location";
  }

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
  ) {
    return "read";
  }

  if (
    c.includes("moneda") ||
    c.includes("billete") ||
    c.includes("dinero") ||
    c.includes("cuanto dinero") ||
    c.includes("valor")
  ) {
    return "money";
  }

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
    c.includes("que es esto") ||
    c.includes("que hay aqui") ||
    c.includes("coche") ||
    c.includes("objeto") ||
    c.includes("persona") ||
    c.includes("obstaculo")
  ) {
    return "describe";
  }

  if (
    c.includes("ayuda") ||
    c.includes("que puedo decir") ||
    c.includes("comandos")
  ) {
    return "help";
  }

  if (
    c.includes("clarovision") ||
    c.includes("claro vision") ||
    c.includes("oye") ||
    c.includes("escucha") ||
    c.includes("hola") ||
    c.includes("asistente")
  ) {
    return "wake";
  }

  return "unknown";
}

export default function HomeScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [status, setStatus] = useState<AppStatus>("idle");
  const [cameraActive, setCameraActive] = useState(true);
  const [lastCaptureTime, setLastCaptureTime] = useState(0);
  const [lastImageBase64, setLastImageBase64] = useState<string | undefined>();
  const [lastMessage, setLastMessage] = useState(
  "Estoy a tu disposición. Dime qué necesitas."
);
  const [voiceText, setVoiceText] = useState("");
  const [waitingCommand, setWaitingCommand] = useState(false);

  const statusRef = useRef<AppStatus>("idle");
  const listeningWantedRef = useRef(true);
  const waitingCommandRef = useRef(false);
  const lastMessageRef = useRef(lastMessage);
  const lastImageRef = useRef<string | undefined>(undefined);

  const isBusy =
    status === "capturing" || status === "thinking" || status === "speaking";

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    waitingCommandRef.current = waitingCommand;
  }, [waitingCommand]);

  useEffect(() => {
    lastMessageRef.current = lastMessage;
  }, [lastMessage]);

  useEffect(() => {
    lastImageRef.current = lastImageBase64;
  }, [lastImageBase64]);

  useEffect(() => {
  const timer = setTimeout(() => {
    if (!permission || !permission.granted) {
      requestPermission();
    }
  }, 1000);

  return () => clearTimeout(timer);
}, [permission]);

  useEffect(() => {
  const timer = setTimeout(() => {
    speak("Estoy a tu disposición. Dime qué necesitas.");
  }, 700);

  return () => clearTimeout(timer);
}, []);

  useSpeechRecognitionEvent("start", () => {
    setStatus("listening");
    setVoiceText("");
  });

  useSpeechRecognitionEvent("end", () => {
    if (statusRef.current === "listening") setStatus("idle");

    if (listeningWantedRef.current && !isBusyStatus()) {
      setTimeout(() => {
        startListening(false);
      }, 500);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.log("Speech error:", event);
    setStatus("error");

    if (listeningWantedRef.current) {
      setTimeout(() => {
        startListening(false);
      }, 1200);
    }
  });

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript || "";
    if (!transcript) return;

    setVoiceText(transcript);
    handleVoiceCommand(transcript);
  });

  const isBusyStatus = () => {
    return (
      statusRef.current === "capturing" ||
      statusRef.current === "thinking" ||
      statusRef.current === "speaking"
    );
  };

  const say = (text: string) => {
    setLastMessage(text);
    speak(text, false);
  };

  const sayAndListen = (text: string) => {
    setLastMessage(text);
    speak(text, true);
  };

  const speak = (text: string, listenAfter = true) => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}

    Speech.stop();
    setStatus("speaking");

    Speech.speak(text, {
      language: "es-ES",
      rate: 0.92,
      pitch: 1,
      onDone: () => {
        setStatus("idle");
        if (listenAfter && listeningWantedRef.current) {
          setTimeout(() => startListening(false), 450);
        }
      },
      onStopped: () => {
        setStatus("idle");
        if (listenAfter && listeningWantedRef.current) {
          setTimeout(() => startListening(false), 450);
        }
      },
      onError: () => {
        setStatus("idle");
        if (listenAfter && listeningWantedRef.current) {
          setTimeout(() => startListening(false), 450);
        }
      },
    });
  };

  const startListening = async (withPrompt = false) => {
    if (isBusyStatus()) return;

    try {
      Speech.stop();

      const result =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!result.granted) {
        say("Necesito permiso de micrófono y reconocimiento de voz.");
        return;
      }

      if (withPrompt) setLastMessage("Te escucho.");

      setStatus("listening");

      ExpoSpeechRecognitionModule.start({
        lang: "es-ES",
        interimResults: false,
        continuous: false,
        requiresOnDeviceRecognition: false,
      });
    } catch (error) {
      console.error(error);
      setStatus("idle");
    }
  };

  const pauseListening = () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}
    setStatus("idle");
  };

  const handleVoiceCommand = async (text: string) => {
    const intent = detectIntent(text);

    if (intent === "stop") {
      Speech.stop();
      setWaitingCommand(false);
      setLastMessage("Silencio.");
      setStatus("idle");
      setTimeout(() => startListening(false), 600);
      return;
    }

    if (intent === "wake") {
      setWaitingCommand(true);
      sayAndListen("Te escucho. ¿Qué necesitas?");
      return;
    }

    if (intent === "unknown") {
      if (waitingCommandRef.current) {
        setWaitingCommand(false);
        sayAndListen(
          "No he entendido. Puedes decir: describe, léeme esto, qué moneda es, más detalle, repite o dónde estoy."
        );
      }
      return;
    }

    setWaitingCommand(false);

    if (intent === "repeat") {
      speak(lastMessageRef.current, true);
      return;
    }

    if (intent === "help") {
      sayAndListen(
        "Puedes decir: qué tengo delante, léeme esto, qué moneda es, más detalle, repite, dónde estoy o calla."
      );
      return;
    }

    if (intent === "location") {
      await getLocation();
      return;
    }

    if (intent === "detail") {
      await moreDetail();
      return;
    }

    if (intent === "read") {
      await captureAndAnalyze("read");
      return;
    }

    if (intent === "money") {
      await captureAndAnalyze("money");
      return;
    }

    if (intent === "describe") {
      await captureAndAnalyze("normal");
      return;
    }
  };

  const captureAndAnalyze = async (mode: Mode) => {
    const now = Date.now();

    if (now - lastCaptureTime < 3000) {
      sayAndListen("Espera un momento antes de volver a analizar.");
      return;
    }

    if (!cameraRef.current) {
      sayAndListen("La cámara no está lista.");
      return;
    }

    if (isBusyStatus()) return;

    try {
      pauseListening();

      setStatus("capturing");
      setLastCaptureTime(now);
      setLastMessage("Capturando.");

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.75,
        base64: true,
        skipProcessing: true,
      });

      setLastImageBase64(photo?.base64);

      setStatus("thinking");

      if (mode === "read") {
        setLastMessage("Leyendo.");
        speak("Leyendo.", false);
      } else if (mode === "money") {
        setLastMessage("Analizando dinero.");
        speak("Analizando dinero.", false);
      } else {
        setLastMessage("Analizando.");
        speak("Analizando.", false);
      }

      const description = await describeImage(
        photo?.base64,
        mode,
        lastMessageRef.current
      );

      sayAndListen(description);
    } catch (error) {
      console.error("Error capturando imagen:", error);
      sayAndListen("No se pudo analizar. Inténtalo otra vez.");
    }
  };

  const moreDetail = async () => {
    if (isBusyStatus()) return;

    if (!lastImageRef.current) {
      sayAndListen("Primero dime qué tengo delante para poder ampliar detalles.");
      return;
    }

    try {
      pauseListening();

      setStatus("thinking");
      setLastMessage("Ampliando detalles.");
      speak("Ampliando detalles.", false);

      const description = await describeImage(
        lastImageRef.current,
        "detail",
        lastMessageRef.current
      );

      sayAndListen(description);
    } catch (error) {
      console.error("Error pidiendo más detalle:", error);
      sayAndListen("No pude ampliar la descripción.");
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
        sayAndListen("No tengo permiso para acceder a la ubicación.");
        return;
      }

      setLastMessage("Buscando ubicación.");
      speak("Buscando ubicación.", false);

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

      sayAndListen(msg);
    } catch (error) {
      console.error(error);
      sayAndListen("No pude obtener la ubicación.");
    }
  };

  const getStatusText = () => {
    if (status === "listening") {
      return waitingCommand
        ? "Te escucho. Di tu comando."
        : "Escuchando. Di ClaroVision o un comando.";
    }
    if (status === "capturing") return "Capturando...";
    if (status === "thinking") return "Analizando...";
    if (status === "speaking") return "Hablando...";
    if (status === "error") return "Hubo un error.";
    return "Manos libres activo.";
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
            sayAndListen("Cámara activada.");
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
        <Pressable
          style={[
            styles.voiceButton,
            status === "listening" && styles.voiceButtonActive,
            isBusy && styles.disabled,
          ]}
          onPress={() => startListening(true)}
          disabled={status === "capturing" || status === "thinking"}
          accessibilityRole="button"
          accessibilityLabel="Escuchar ahora"
        >
          <Text style={styles.voiceButtonText}>
            {status === "listening" ? "Escuchando..." : "Manos libres"}
          </Text>
          <Text style={styles.voiceButtonHint}>
            Di “ClaroVision”, “analiza”, “léeme esto” o “repite”
          </Text>
        </Pressable>

        <Pressable
          style={styles.emergencyButton}
          onPress={() => {
            Speech.stop();
            pauseListening();
            setWaitingCommand(false);
            setLastMessage("Silencio.");
            setTimeout(() => startListening(false), 700);
          }}
          accessibilityRole="button"
          accessibilityLabel="Callar"
        >
          <Text style={styles.emergencyButtonText}>Callar</Text>
        </Pressable>

        {!!voiceText && (
          <Text style={styles.voiceText} numberOfLines={2}>
            Has dicho: {voiceText}
          </Text>
        )}

        <Text style={styles.lastMessage} numberOfLines={4}>
          {lastMessage}
        </Text>

        <View style={styles.smallActions}>
          <Pressable
            style={styles.smallButton}
            onPress={() => captureAndAnalyze("normal")}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Describir"
          >
            <Text style={styles.smallButtonText}>Describir</Text>
          </Pressable>

          <Pressable
            style={styles.smallButton}
            onPress={moreDetail}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Más detalle"
          >
            <Text style={styles.smallButtonText}>Detalle</Text>
          </Pressable>

          <Pressable
            style={styles.smallButton}
            onPress={() => speak(lastMessageRef.current, true)}
            accessibilityRole="button"
            accessibilityLabel="Repetir"
          >
            <Text style={styles.smallButtonText}>Repetir</Text>
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
    top: 54,
    left: 24,
    right: 24,
    alignItems: "center",
  },

  logo: {
    width: 112,
    height: 112,
    marginBottom: 10,
    resizeMode: "contain",
    borderRadius: 24,
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
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.82)",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    overflow: "hidden",
  },

  bottomOverlay: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    alignItems: "center",
  },

  voiceButton: {
    width: "100%",
    minHeight: 116,
    borderRadius: 34,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 6,
    borderColor: "#bbf7d0",
  },

  voiceButtonActive: {
    backgroundColor: "#ef4444",
    borderColor: "#fecaca",
  },

  disabled: {
    opacity: 0.7,
  },

  voiceButtonText: {
    color: "#000",
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
  },

  voiceButtonHint: {
    marginTop: 6,
    color: "#000",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: 12,
  },

  emergencyButton: {
    marginTop: 12,
    width: "100%",
    minHeight: 58,
    borderRadius: 22,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },

  emergencyButtonText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },

  voiceText: {
    marginTop: 10,
    color: "#bbf7d0",
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: "hidden",
  },

  lastMessage: {
    marginTop: 10,
    color: "#fff",
    fontSize: 17,
    lineHeight: 23,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.78)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    overflow: "hidden",
  },

  smallActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    width: "100%",
  },

  smallButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#fde047",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000",
  },

  smallButtonText: {
    color: "#000",
    fontSize: 15,
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