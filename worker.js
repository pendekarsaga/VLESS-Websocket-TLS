export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ===== GANTI SESUAI PUNYA KAMU =====
    const UUID = "399f950e-43fe-4f5a-8d54-6e0262864022";
    const PATH = "/ws";
    // ==================================

    if (url.pathname !== PATH) {
      return new Response("Not Found", { status: 404 });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    server.addEventListener("message", (event) => {
      // relay mentah (pass-through)
      server.send(event.data);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
};