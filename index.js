// ============================================
// KANCIL VPN RAILWAY GATEWAY
// Clean Short Path + Cyberpunk Dashboard + Full UDP
// ============================================

const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const net = require('net');
const dgram = require('dgram');
const url = require('url');

const PORT = process.env.PORT || 3000;
const SYSTEM_UUID = process.env.SYSTEM_UUID || "c48619fe-8f02-49e0-b9e9-edf763e17e21";

// Mapping Path Spesifik
const PROXY_MAP = {
  "id-akamai": "172.232.249.224:2053",
  "id-deneva": "202.155.95.132:443",
  "sg-ovh": "51.79.177.53:443",
  "sg-oracle": "138.2.64.229:443"
};

const DNS_SERVERS = ["8.8.8.8", "1.1.1.1"];
const horse = Buffer.from("dHJvamFu", 'base64').toString(); // trojan
const flash = Buffer.from("dm1lc3M=", 'base64').toString(); // vmess

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

class GatewayServer {
  constructor() {
    this.wss = null;
    this.activeUDPConnections = new Map();
  }

  handleHttpRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);

    if (req.method === 'OPTIONS') {
      res.writeHead(200, CORS_HEADERS);
      res.end();
      return;
    }

    if (parsedUrl.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ status: 'healthy', uptime: Math.floor(process.uptime()) }));
      return;
    }

    if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/dashboard') {
      const currentHost = req.headers.host || 'localhost:3000';
      const uptime = Math.floor(process.uptime());
      const ramUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KANCIL VPN // CYBERPUNK GATEWAY</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
    body { font-family: 'JetBrains Mono', monospace; background-color: #07080e; color: #cbd5e1; }
    .glow-box { box-shadow: 0 0 20px rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); }
    .neon-card { background: #0d0f1a; border: 1px solid #1e293b; }
  </style>
</head>
<body class="min-h-screen pb-12">
  <header class="border-b border-slate-800 bg-[#0a0c16]/90 backdrop-blur sticky top-0 z-50 px-6 py-4">
    <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
          <i class="fa-solid fa-bolt text-lg"></i>
        </div>
        <div>
          <h1 class="text-lg font-bold tracking-wider text-white">KANCIL_VPN<span class="text-emerald-400">.sys</span></h1>
          <p class="text-[10px] text-slate-500">RAILWAY HIGH-SPEED GATEWAY</p>
        </div>
      </div>
      <div class="flex items-center gap-2 bg-emerald-950/60 border border-emerald-800 px-4 py-1.5 rounded-lg">
        <span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
        <span class="text-xs font-semibold text-emerald-300">SERVER ACTIVE</span>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-6 pt-8 space-y-6">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="neon-card p-4 rounded-xl">
        <p class="text-[10px] text-slate-500 font-bold mb-1">UPTIME</p>
        <p class="text-lg font-bold text-white">${uptime}s</p>
      </div>
      <div class="neon-card p-4 rounded-xl">
        <p class="text-[10px] text-slate-500 font-bold mb-1">RAM USED</p>
        <p class="text-lg font-bold text-emerald-400">${ramUsed} MB</p>
      </div>
      <div class="neon-card p-4 rounded-xl">
        <p class="text-[10px] text-slate-500 font-bold mb-1">PROTOKOL</p>
        <p class="text-lg font-bold text-purple-400">VLESS / TROJAN</p>
      </div>
      <div class="neon-card p-4 rounded-xl">
        <p class="text-[10px] text-slate-500 font-bold mb-1">UDP & DNS</p>
        <p class="text-lg font-bold text-amber-400">PASSED 🟢</p>
      </div>
    </div>

    <div class="glow-box bg-[#0c0e18] rounded-2xl p-6">
      <div class="flex items-center gap-2 border-b border-slate-800 pb-3 mb-6">
        <i class="fa-solid fa-sliders text-emerald-400"></i>
        <h2 class="text-sm font-bold tracking-wide text-white">CONFIG GENERATOR</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-slate-400">UUID / Password</label>
              <button onclick="genUUID()" class="text-[10px] text-emerald-400 hover:text-emerald-300">
                <i class="fa-solid fa-arrows-rotate"></i> ACAK UUID
              </button>
            </div>
            <input id="uuid" type="text" value="${SYSTEM_UUID}" class="w-full bg-[#06070c] border border-slate-800 rounded-lg p-2.5 text-xs text-emerald-300 font-mono">
          </div>

          <div>
            <label class="text-xs text-slate-400 block mb-1">Username / Remark</label>
            <input id="remark" type="text" value="Kancil-VPN" class="w-full bg-[#06070c] border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono">
          </div>

          <div>
            <label class="text-xs text-slate-400 block mb-1">Masa Aktif</label>
            <select id="expired" class="w-full bg-[#06070c] border border-slate-800 rounded-lg p-2.5 text-xs text-emerald-300 font-mono">
              <option value="30m">Trial (30 Menit)</option>
              <option value="7d" selected>Weekly (7 Hari)</option>
              <option value="30d">Monthly (30 Hari)</option>
            </select>
          </div>

          <div>
            <label class="text-xs text-slate-400 block mb-1">Pilih Path Proxy</label>
            <select id="path" class="w-full bg-[#06070c] border border-slate-800 rounded-lg p-2.5 text-xs text-emerald-300 font-mono">
              <option value="id-akamai">🇮🇩 /id-akamai (172.232.249.224:2053)</option>
              <option value="id-deneva" selected>🇮🇩 /id-deneva (202.155.95.132:443)</option>
              <option value="sg-ovh">🇸🇬 /sg-ovh (51.79.177.53:443)</option>
              <option value="sg-oracle">🇸🇬 /sg-oracle (138.2.64.229:443)</option>
            </select>
          </div>

          <button onclick="genAcc()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-bold py-3 rounded-lg text-xs transition active:scale-95">
            GENERATE CONFIG LINKS
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] text-purple-400 font-bold">VLESS WS TLS</span>
              <button onclick="copyId('vless')" class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">COPY</button>
            </div>
            <textarea id="vless" readonly class="w-full bg-[#06070c] border border-slate-800 rounded-lg p-2.5 text-xs text-purple-300 font-mono h-28 resize-none"></textarea>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] text-amber-400 font-bold">TROJAN WS TLS</span>
              <button onclick="copyId('trojan')" class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">COPY</button>
            </div>
            <textarea id="trojan" readonly class="w-full bg-[#06070c] border border-slate-800 rounded-lg p-2.5 text-xs text-amber-300 font-mono h-28 resize-none"></textarea>
          </div>
        </div>
      </div>
    </div>
  </main>

  <script>
    const currentHost = location.host.split(':')[0];

    function genUUID() {
      document.getElementById('uuid').value = crypto.randomUUID();
      genAcc();
    }

    function genAcc() {
      const u = document.getElementById('uuid').value.trim();
      const p = document.getElementById('path').value.trim();
      const r = document.getElementById('remark').value.trim() || 'Kancil-VPN';
      const expType = document.getElementById('expired').value;

      let labelExp = "7D";
      if (expType === "30m") labelExp = "30M";
      else if (expType === "30d") labelExp = "30D";

      const cleanPath = "/" + p;
      const remarkTag = encodeURIComponent(\`\${r}[\${labelExp}]-\${p}\`);

      document.getElementById('vless').value = \`vless://\${u}@\${currentHost}:443?encryption=none&security=tls&sni=\${currentHost}&type=ws&host=\${currentHost}&path=\${encodeURIComponent(cleanPath)}#\${remarkTag}\`;
      document.getElementById('trojan').value = \`trojan://\${u}@\${currentHost}:443?security=tls&sni=\${currentHost}&type=ws&host=\${currentHost}&path=\${encodeURIComponent(cleanPath)}#\${remarkTag}\`;
    }

    function copyId(id) {
      const el = document.getElementById(id);
      el.select();
      navigator.clipboard.writeText(el.value);
      alert('Config berhasil disalin!');
    }

    window.onload = genAcc;
  </script>
</body>
</html>`);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  async handleWebSocketConnection(ws, request) {
    try {
      const urlObj = new URL(request.url, `http://${request.headers.host}`);
      // Ambil segmen pertama dari path (misal "id-deneva")
      const rawPath = urlObj.pathname.split('/').filter(Boolean)[0] || "";

      const targetProxy = PROXY_MAP[rawPath];
      if (!targetProxy) {
        if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'Unknown Path');
        return;
      }

      await this.websocketHandler(ws, targetProxy);
    } catch (err) {
      if (ws.readyState === WebSocket.OPEN) ws.close(1011, 'Internal Error');
    }
  }

  async websocketHandler(ws, targetProxy) {
    let remoteSocketWrapper = { value: null };

    ws.on('message', async (message) => {
      try {
        const chunk = Buffer.from(message);
        if (remoteSocketWrapper.value) {
          if (remoteSocketWrapper.value.writable) remoteSocketWrapper.value.write(chunk);
          return;
        }

        const protocol = await this.protocolSniffer(chunk);
        let header;

        if (protocol === horse) header = this.readHorseHeader(chunk);
        else if (protocol === flash) header = this.readFlashHeader(chunk);
        else header = this.readSsHeader(chunk);

        if (header.hasError) throw new Error(header.message);

        if (header.isUDP) {
          return await this.handleUDPOutbound(header.addressRemote, header.portRemote, chunk.slice(header.rawDataIndex), ws, header.version);
        }

        this.handleTCPOutBound(remoteSocketWrapper, targetProxy, header.rawClientData, ws);
      } catch (err) {
        if (ws.readyState === WebSocket.OPEN) ws.close(1011, err.message);
      }
    });

    ws.on('close', () => {
      if (remoteSocketWrapper.value) remoteSocketWrapper.value.end();
      this.cleanupUDP(ws);
    });

    ws.on('error', () => this.cleanupUDP(ws));
  }

  async protocolSniffer(buffer) {
    if (buffer.length >= 62) {
      const d = buffer.slice(56, 60);
      if (d[0] === 0x0d && d[1] === 0x0a && [0x01,0x03,0x7f].includes(d[2]) && [0x01,0x03,0x04].includes(d[3])) return horse;
    }
    const h = buffer.slice(1, 17).toString('hex');
    if (h.match(/^[0-9a-f]{8}[0-9a-f]{4}4[0-9a-f]{3}[89ab][0-9a-f]{3}[0-9a-f]{12}$/i)) return flash;
    return "ss";
  }

  async handleTCPOutBound(remoteSocket, targetProxy, rawClientData, webSocket) {
    const [targetHost, targetPortStr] = targetProxy.split(":");
    const targetPort = parseInt(targetPortStr, 10);

    try {
      const s = net.createConnection({ host: targetHost, port: targetPort }, () => {
        s.write(rawClientData);
      });

      remoteSocket.value = s;

      s.on('data', (data) => {
        if (webSocket.readyState === WebSocket.OPEN) webSocket.send(data);
      });

      s.on('close', () => { if (webSocket.readyState === WebSocket.OPEN) webSocket.close(); });
      s.on('error', () => { if (webSocket.readyState === WebSocket.OPEN) webSocket.close(); });
    } catch (e) {
      if (webSocket.readyState === WebSocket.OPEN) webSocket.close();
    }
  }

  async handleUDPOutbound(targetAddress, targetPort, dataChunk, webSocket, responseHeader) {
    try {
      let header = responseHeader;
      let destAddress = targetAddress;
      if (targetPort === 53) {
        destAddress = DNS_SERVERS[Math.floor(Math.random() * DNS_SERVERS.length)];
      }

      const key = `${destAddress}:${targetPort}:${Date.now()}`;
      const sock = dgram.createSocket('udp4');
      this.activeUDPConnections.set(key, { socket: sock, webSocket });

      sock.send(dataChunk, targetPort, destAddress, (e) => {
        if (e) { try { sock.close(); } catch (_) {} this.activeUDPConnections.delete(key); }
      });

      sock.on('message', (msg) => {
        if (webSocket.readyState === WebSocket.OPEN) {
          if (header) {
            webSocket.send(Buffer.concat([Buffer.from(header), msg]));
            header = null;
          } else {
            webSocket.send(msg);
          }
        }
      });

      setTimeout(() => {
        try { sock.close(); } catch (_) {}
        this.activeUDPConnections.delete(key);
      }, 15000);
    } catch (e) {}
  }

  cleanupUDP(webSocket) {
    for (const [key, conn] of this.activeUDPConnections) {
      if (conn.webSocket === webSocket) {
        try { conn.socket.close(); } catch (_) {}
        this.activeUDPConnections.delete(key);
      }
    }
  }

  readSsHeader(buf) {
    const at = buf[0]; let al = 0, avi = 1, av = "";
    if (at === 1) { al = 4; av = Array.from(buf.slice(avi, avi+al)).join("."); }
    else if (at === 3) { al = buf[avi]; avi += 1; av = buf.slice(avi, avi+al).toString(); }
    else if (at === 4) { al = 16; const ip = []; for(let i=0;i<8;i++) ip.push(buf.readUInt16BE(avi+i*2).toString(16)); av = ip.join(":"); }
    else return { hasError: true, message: `Invalid addr type: ${at}` };
    const pi = avi + al;
    const pr = buf.readUInt16BE(pi);
    return { hasError: false, addressRemote: av, portRemote: pr, rawDataIndex: pi+2, rawClientData: buf.slice(pi+2), version: null, isUDP: pr === 53 || pr > 1024 };
  }

  readFlashHeader(buf) {
    const v = buf[0]; let udp = false;
    const ol = buf[17]; const cmd = buf[18+ol];
    if (cmd === 2) udp = true;
    const pi = 18+ol+1; const pr = buf.readUInt16BE(pi);
    let ai = pi+2; const at = buf[ai]; let al = 0, avi = ai+1, av = "";
    if (at === 1) { al = 4; av = Array.from(buf.slice(avi, avi+al)).join("."); }
    else if (at === 2) { al = buf[avi]; avi += 1; av = buf.slice(avi, avi+al).toString(); }
    else if (at === 3) { al = 16; const ip = []; for(let i=0;i<8;i++) ip.push(buf.readUInt16BE(avi+i*2).toString(16)); av = ip.join(":"); }
    return { hasError: false, addressRemote: av, portRemote: pr, rawDataIndex: avi+al, rawClientData: buf.slice(avi+al), version: Buffer.from([v,0]), isUDP: udp };
  }

  readHorseHeader(buf) {
    const db = buf.slice(58);
    if (db.length < 6) return { hasError: true, message: "Invalid data" };
    let udp = db[0] === 3;
    let at = db[1]; let al = 0, avi = 2, av = "";
    if (at === 1) { al = 4; av = Array.from(db.slice(avi, avi+al)).join("."); }
    else if (at === 3) { al = db[avi]; avi += 1; av = db.slice(avi, avi+al).toString(); }
    else if (at === 4) { al = 16; const ip = []; for(let i=0;i<8;i++) ip.push(db.readUInt16BE(avi+i*2).toString(16)); av = ip.join(":"); }
    const pi = avi + al;
    const pr = db.readUInt16BE(pi);
    return { hasError: false, addressRemote: av, portRemote: pr, rawDataIndex: pi+4, rawClientData: db.slice(pi+4), version: null, isUDP: udp };
  }

  start(port = PORT) {
    const server = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    this.wss = new WebSocketServer({ server, perMessageDeflate: false });
    this.wss.on('connection', (ws, req) => {
      this.handleWebSocketConnection(ws, req);
    });

    server.listen(port, '0.0.0.0', () => {
      console.log(`Server running on port ${port}`);
    });
  }
}

if (require.main === module) {
  const server = new GatewayServer();
  server.start();
}
