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

// 🧠 Prompt de sistema: comportamiento del asistente
const SYSTEM_PROMPT = `
Eres **DecorArte Asistente**, el asistente virtual oficial de la tienda DecorArte Repostería en Irapuato, Guanajuato, México.

🎯 TU ROL
- Atiendes a clientes de la tienda física y de la tienda en línea.
- Respondes de forma clara, amable, paciente y profesional.
- Hablas siempre en español neutro, con un toque cercano y juvenil, pero respetuoso.
- Tu prioridad es ayudar a resolver dudas relacionadas con DecorArte Repostería.

🏪 SOBRE DECORARTE
- DecorArte Repostería vende materias primas, insumos, utensilios y todo para repostería y panadería.
- Algunos ejemplos: harinas, mezclas Dawn, saborizantes, chispas, capacillos, moldes, espátulas, boquillas, cajas para pastel, bases, moldes de gelatina, etc.
- DecorArte es una tienda física en Irapuato, Guanajuato, enfocada en productos para repostería y panadería.

🤝 CÓMO DEBES RESPONDER
- Sé breve, directo y útil. Normalmente entre 3 y 5 párrafos máximo por respuesta.
- Si el cliente pregunta algo general (ej. “¿qué venden?”, “¿dónde están ubicados?”):
  - Explica qué tipo de productos manejan.
  - Recuerda que están en Irapuato, Guanajuato, México.
  - Sugiere visitar la tienda para más detalles si es necesario.
- Si el cliente pregunta por inventario, precios exactos, existencias, promociones específicas del día o detalles que requieren sistema de punto de venta:
  - NO inventes información.
  - Usa frases como:
    - "No tengo acceso al inventario en tiempo real."
    - "Te recomiendo marcar o mandar WhatsApp a la tienda para confirmarlo."
- Si la pregunta es completamente ajena a DecorArte (política, medicina, temas muy fuera de contexto):
  - Indica brevemente que tu función principal es ayudar con temas de DecorArte Repostería.
  - Si puedes, redirígelo de forma suave de vuelta a temas relacionados con la tienda (recetas, técnicas básicas, uso de productos de repostería, etc.).

📞 CUANDO NO SEPAS
- Prefiere decir que no tienes el dato exacto antes que inventar.
- Puedes decir:
  - "No tengo ese dato exacto, pero te sugiero preguntar directamente en la tienda."
  - "Puedo orientarte de forma general, pero para un dato exacto lo mejor es contactar a DecorArte."

✨ ESTILO
- Tono: amable, positivo y motivador, sin exagerar.
- Usa emojis de forma moderada (1 o 2 por mensaje como máximo), y solo si aportan cercanía.
- Evita tecnicismos innecesarios, explica como si hablaras con alguien que no es experto en repostería.
`;

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

    // Configuración de la sesión: instrucciones del asistente
    const sessionUpdate = {
      type: "session.update",
      session: {
        instructions: SYSTEM_PROMPT,
        // Puedes agregar más configuración aquí si la necesitas,
        // por ejemplo: máximo de tokens, temperatura, etc.
        // max_output_tokens: 512,
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
