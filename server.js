// server.js
import "dotenv/config";
import express from "express";
import { WebSocketServer } from "ws";
import WebSocket from "ws";

const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.MODEL || "gpt-4o-realtime-preview";

if (!OPENAI_API_KEY) {
  console.error("❌ Falta OPENAI_API_KEY en el archivo .env");
  process.exit(1);
}

const app = express();

// Endpoint simple para comprobar que el servidor está vivo
app.get("/", (req, res) => {
  res.send("✅ Servidor DecorArte Realtime está corriendo");
});

// Inicia servidor HTTP
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP en http://localhost:${PORT}`);
});

// Servidor WebSocket para el navegador (front)
const wss = new WebSocketServer({ server });

wss.on("connection", (clientWs) => {
  console.log("🟢 Cliente conectado desde el navegador");

  // Conexión WebSocket a OpenAI Realtime
  const openAiWs = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${MODEL}`,
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    }
  );

  openAiWs.on("open", () => {
    console.log("🔵 Conectado a OpenAI Realtime");

    // Configuración de la sesión: rol + queremos TEXTO
    const sessionUpdate = {
      type: "session.update",
      session: {
        instructions:
          "Eres el asistente virtual de la tienda DecorArte Repostería. Respondes de forma clara, amable y profesional. Ayudas a los clientes con dudas sobre productos, horarios, ubicación, envíos, pagos, promociones, y recetas. Si no tienes información suficiente, lo dices con honestidad y sugieres que contacten a la tienda directamente. Tu voz es masculina, juvenil y agradable.",
        modalities: ["text"], // pedimos texto como modalidad principal
      },
    };

    openAiWs.send(JSON.stringify(sessionUpdate));
  });

  // Eventos que llegan desde OpenAI → los reenviamos al navegador
  openAiWs.on("message", (data) => {
    const text = data.toString();
    console.log("🔵 EVENTO DESDE OPENAI:", text); // Log para depurar

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(text);
    }
  });

  openAiWs.on("close", () => {
    console.log("🔴 Conexión con OpenAI cerrada");
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });

  openAiWs.on("error", (err) => {
    console.error("❌ Error en Realtime API:", err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: "error",
          message: "Error en la conexión con OpenAI Realtime",
        })
      );
    }
  });

  // Mensajes que llegan del navegador → se mandan a OpenAI
  clientWs.on("message", (msg) => {
    try {
      const event = JSON.parse(msg.toString());
      if (openAiWs.readyState === WebSocket.OPEN) {
        openAiWs.send(JSON.stringify(event));
      }
    } catch (error) {
      console.error("❌ Error parseando mensaje del cliente:", error);
    }
  });

  clientWs.on("close", () => {
    console.log("🟡 Cliente del navegador se desconectó");
    if (openAiWs.readyState === WebSocket.OPEN) {
      openAiWs.close();
    }
  });
});
