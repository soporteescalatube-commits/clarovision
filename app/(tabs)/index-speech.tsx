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
    "Pulsa Hablar y dime qué necesitas."
  );
  const [voiceText, setVoiceText] = useState("");
  const [typedCommand, setTypedCommand] = useState("");
  const [waitingCommand, setWaitingCommand] = useState(false);

  const statusRef = useRef<AppStatus>("idle");
  const waitingCommandRef = useRef(false);
  const lastMessageRef = useRef(lastMessage);
  const lastImageRef = useRef<string | undefined>(undefined);
  const handlingCommandRef = useRef(false);

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

  useSpeechRecognitionEvent("start", () => {
    setStatus("listening");
    setVoiceText("");
  });

  useSpeechRecognitionEvent("end", () => {
    if (statusRef.current === "listening") {
      setStatus("idle");
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.log("Speech error:", event);
    setStatus("error");
    setLastMessage(
      "No he podido escuchar bien. Pulsa Hablar otra vez o escribe el comando."
    );
  });

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript || "";
    if (!transcript || handlingCommandRef.current) return;

    setVoiceText(transcript);

    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}

    handleVoiceCommand(transcript);
  });

  const isBusyStatus = () => {
    return (
      statusRef.current === "capturing" ||
      statusRef.current === "thinking" ||
      statusRef.current === "speaking"
    );
  };

  const stopEverything = () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}

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
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}

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
    if (isBusyStatus()) return;

    try {
      Speech.stop();

      const result =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!result.granted) {
        setStatus("error");
        setLastMessage(
          "Necesito permiso de micrófono. Revisa los ajustes del navegador o del iPhone."
        );
        return;
      }

      setWaitingCommand(true);
      setLastMessage("Te escucho. Di describe, léeme esto, moneda, detalle o ubicación.");
      setVoiceText("");
      setStatus("listening");

      ExpoSpeechRecognitionModule.start({
        lang: "es-ES",
        interimResults: false,
        continuous: false,
        requiresOnDeviceRecognition: false,
      });
    } catch (error) {
      console.error(error);
      setStatus("error");
      setLastMessage(
        "No pude activar el micrófono. Pulsa otra vez o escribe el comando."
      );
    }
  };

  const pauseListening = () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}

    if (statusRef.current === "listening") {
      setStatus("idle");
    }
  };

  const handleVoiceCommand = async (text: string) => {
    if (handlingCommandRef.current) return;
    handlingCommandRef.current = true;

    try {
      const intent = detectIntent(text);

      if (intent === "stop") {
        stopEverything();
        setLastMessage("Silencio.");
        return;
      }

      if (intent === "wake") {
        setWaitingCommand(true);
        speak("Te escucho. Pulsa Hablar y dime qué necesitas.");
        return;
      }

      if (intent === "unknown") {
        setWaitingCommand(false);
        speak(
          "No he entendido. Puedes decir: describe, léeme esto, qué moneda es, más detalle, repite o dónde estoy."
        );
        return;
      }

      setWaitingCommand(false);

      if (intent === "repeat") {
        speak(lastMessageRef.current);
        return;
      }

      if (intent === "help") {
        speak(
          "Puedes decir: describe, léeme esto, qué moneda es, más detalle, repite, dónde estoy o calla."
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

  const captureAndAnalyze = async (mode: Mode) => {
    const now = Date.now();

    if (now - lastCaptureTime < 3000) {
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
        quality: 0.75,
        base64: true,
        skipProcessing: true,
      });

      setLastImageBase64(photo?.base64);

      setStatus("thinking");

      if (mode === "read") {
        setLastMessage("Leyendo.");
        announce("Leyendo.");
      } else if (mode === "money") {
        setLastMessage("Analizando dinero.");
        announce("Analizando dinero.");
      } else {
        setLastMessage("Analizando.");
        announce("Analizando.");
      }

      const description = await describeImage(
        photo?.base64,
        mode,
        lastMessageRef.current
      );

      speak(description);
    } catch (error) {
      console.error("Error capturando imagen:", error);
      speak("No se pudo analizar. Inténtalo otra vez.");
    }
  };

  const moreDetail = async () => {
    if (isBusyStatus()) return;

    if (!lastImageRef.current) {
      speak("Primero dime qué tengo delante para poder ampliar detalles.");
      return;
    }

    try {
      pauseListening();

      setStatus("thinking");
      setLastMessage("Ampliando detalles.");
      announce("Ampliando detalles.");

      const description = await describeImage(
        lastImageRef.current,
        "detail",
        lastMessageRef.current
      );

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

      speak(msg);
    } catch (error) {
      console.error(error);
      speak("No pude obtener la ubicación.");
    }
  };

  const getStatusText = () => {
    if (status === "listening") return "Te escucho.";
    if (status === "capturing") return "Capturando...";
    if (status === "thinking") return "Analizando...";
    if (status === "speaking") return "Respondiendo...";
    if (status === "error") return "Pulsa Hablar otra vez.";
    return "Pulsa Hablar.";
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
        Has dicho: {voiceText}
      </Text>
    )}

    <Text style={styles.lastMessage} numberOfLines={2}>
      {lastMessage}
    </Text>
  </View>

  <View style={styles.mainControls}>
    <Pressable
      style={[
        styles.voiceButton,
        status === "listening" && styles.voiceButtonActive,
        isBusy && styles.disabled,
      ]}
      onPress={status === "listening" ? pauseListening : startListening}
      disabled={status === "capturing" || status === "thinking"}
      accessibilityRole="button"
      accessibilityLabel={
        status === "listening" ? "Parar de escuchar" : "Hablar ahora"
      }
    >
      <Text style={styles.voiceButtonText}>
        {status === "listening" ? "Parar" : "Hablar"}
      </Text>
    </Pressable>

    <Pressable
      style={styles.emergencyButton}
      onPress={() => {
        stopEverything();
        setLastMessage("Silencio.");
      }}
      accessibilityRole="button"
      accessibilityLabel="Callar"
    >
      <Text style={styles.emergencyButtonText}>Callar</Text>
    </Pressable>
  </View>

  <View style={styles.quickActions}>
    <Pressable
      style={styles.quickButton}
      onPress={() => captureAndAnalyze("normal")}
      disabled={isBusy}
      accessibilityRole="button"
      accessibilityLabel="Describir lo que hay delante"
    >
      <Text style={styles.quickButtonText}>Describir</Text>
    </Pressable>

    <Pressable
      style={styles.quickButton}
      onPress={() => captureAndAnalyze("read")}
      disabled={isBusy}
      accessibilityRole="button"
      accessibilityLabel="Leer texto"
    >
      <Text style={styles.quickButtonText}>Leer</Text>
    </Pressable>

    <Pressable
      style={styles.quickButton}
      onPress={moreDetail}
      disabled={isBusy}
      accessibilityRole="button"
      accessibilityLabel="Más detalle"
    >
      <Text style={styles.quickButtonText}>Detalle</Text>
    </Pressable>
  </View>

  <View style={styles.textCommandBox}>
    <TextInput
      style={styles.textInput}
      placeholder="Escribe si falla el micro"
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

  <View style={styles.smallActions}>
    <Pressable
      style={styles.smallButton}
      onPress={() => captureAndAnalyze("money")}
      disabled={isBusy}
      accessibilityRole="button"
      accessibilityLabel="Analizar dinero"
    >
      <Text style={styles.smallButtonText}>Dinero</Text>
    </Pressable>

    <Pressable
      style={styles.smallButton}
      onPress={() => speak(lastMessageRef.current)}
      accessibilityRole="button"
      accessibilityLabel="Repetir respuesta"
    >
      <Text style={styles.smallButtonText}>Repetir</Text>
    </Pressable>

    <Pressable
      style={styles.smallButton}
      onPress={getLocation}
      disabled={isBusy}
      accessibilityRole="button"
      accessibilityLabel="Dónde estoy"
    >
      <Text style={styles.smallButtonText}>Ubicación</Text>
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
  top: 46,
  left: 16,
  right: 16,
  alignItems: "center",
},

  logo: {
  width: 76,
  height: 76,
  marginBottom: 6,
  resizeMode: "contain",
  borderRadius: 18,
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
  fontSize: 18,
  fontWeight: "900",
  textAlign: "center",
  backgroundColor: "rgba(0,0,0,0.78)",
  paddingHorizontal: 14,
  paddingVertical: 9,
  borderRadius: 14,
  overflow: "hidden",
},

  bottomOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    alignItems: "center",
  },
messagePanel: {
  width: "100%",
  backgroundColor: "rgba(0,0,0,0.72)",
  borderRadius: 18,
  paddingHorizontal: 12,
  paddingVertical: 8,
  marginBottom: 8,
},

mainControls: {
  width: "100%",
  flexDirection: "row",
  gap: 10,
},
  voiceButton: {
  flex: 1,
  minHeight: 74,
  borderRadius: 24,
  backgroundColor: "#22c55e",
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 4,
  borderColor: "#bbf7d0",
},

  voiceButtonActive: {
    backgroundColor: "#ef4444",
    borderColor: "#fecaca",
  },

  disabled: {
    opacity: 0.65,
  },

  voiceButtonText: {
  color: "#000",
  fontSize: 30,
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

  quickActions: {
  flexDirection: "row",
  gap: 8,
  marginTop: 8,
  width: "100%",
},

  quickButton: {
  flex: 1,
  minHeight: 50,
  borderRadius: 16,
  backgroundColor: "#fde047",
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 2,
  borderColor: "#000",
},

  quickButtonText: {
  color: "#000",
  fontSize: 16,
  fontWeight: "900",
},

  emergencyButton: {
  width: 116,
  minHeight: 74,
  borderRadius: 24,
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
  color: "#bbf7d0",
  fontSize: 14,
  lineHeight: 19,
  textAlign: "center",
  marginBottom: 4,
},

  lastMessage: {
  color: "#fff",
  fontSize: 16,
  lineHeight: 21,
  textAlign: "center",
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
  borderRadius: 14,
  backgroundColor: "rgba(15,23,42,0.92)",
  color: "#fff",
  paddingHorizontal: 12,
  fontSize: 15,
  borderWidth: 2,
  borderColor: "#94a3b8",
},

  sendButton: {
  minWidth: 82,
  minHeight: 46,
  borderRadius: 14,
  backgroundColor: "#38bdf8",
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 2,
  borderColor: "#000",
},

  sendButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "900",
  },

  smallActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    width: "100%",
  },

  smallButton: {
  flex: 1,
  minHeight: 44,
  borderRadius: 14,
  backgroundColor: "#fff",
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 2,
  borderColor: "#000",
},

  smallButtonText: {
    color: "#000",
    fontSize: 14,
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