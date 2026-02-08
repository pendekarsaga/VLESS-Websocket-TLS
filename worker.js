export default {
  async fetch(request) {
    const url = new URL(request.url);
    const PATH = "/edu";

    if (url.pathname !== PATH) {
      return new Response("Not Found", { status: 404 });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket only", { status: 400 });
    }

    const [client, server] = new WebSocketPair();
    server.accept();

    let tcpSocket;
    let writer;
    let stage = 0;

    server.addEventListener("message", async (event) => {
      try {
        const data = new Uint8Array(event.data);

        // ===== STAGE 0: PARSE VLESS HEADER =====
        if (stage === 0) {
          let i = 0;

          i += 1;          // version
          i += 16;         // UUID

          const optLen = data[i];
          i += 1 + optLen;

          i += 1;          // command

          const port = (data[i] << 8) | data[i + 1];
          i += 2;

          const addrType = data[i];
          i += 1;

          let host = "";

          if (addrType === 1) {
            // IPv4
            host = `${data[i++]}.${data[i++]}.${data[i++]}.${data[i++]}`;
          } else if (addrType === 2) {
            // Domain
            const len = data[i++];
            host = new TextDecoder().decode(data.slice(i, i + len));
            i += len;
          } else if (addrType === 3) {
            // IPv6
            host = Array.from(data.slice(i, i + 16))
              .map((b, idx) =>
                idx % 2 ? b.toString(16).padStart(2, "0") : ""
              )
              .join(":");
            i += 16;
          } else {
            server.close(1003, "Unsupported address type");
            return;
          }

          // ===== OPEN TCP CONNECTION =====
          tcpSocket = await connect({
            hostname: host,
            port: port,
          });

          writer = tcpSocket.writable.getWriter();

          tcpSocket.readable.pipeTo(
            new WritableStream({
              write(chunk) {
                server.send(chunk);
              },
            })
          );

          // kirim payload sisa (jika ada)
          if (i < data.length) {
            await writer.write(data.slice(i));
          }

          stage = 1;
          return;
        }

        // ===== STAGE 1: NORMAL RELAY =====
        await writer.write(data);

      } catch (e) {
        server.close(1011, "Relay error");
      }
    });

    server.addEventListener("close", () => {
      try {
        writer?.close();
        tcpSocket?.close();
      } catch {}
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};