// ============================================
// KANCIL VPN RAILWAY GATEWAY
// Full Protocol Sniffer (VLESS/Trojan/VMess/SS) + Cyberpunk Dashboard
// ============================================

const WebSocket = require('ws');
const net = require('net');
const dgram = require('dgram');
const fetch = require('node-fetch');
const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;
const KV_PRX_URL = "https://raw.githubusercontent.com/backup-heavenly-demons/gateway/refs/heads/main/kvProxyList.json";

const horse = Buffer.from("dHJvamFu", 'base64').toString(); // trojan
const flash = Buffer.from("dm1lc3M=", 'base64').toString(); // vmess

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

class GatewayServer {
  constructor() {
    this.prxIP = "";
    this.wss = null;
    this.httpServer = null;
    this.activeUDPConnections = new Map();
    this.totalRX = 0;
    this.totalTX = 0;
  }

  async getKVPrxList() {
    try {
      const res = await fetch(KV_PRX_URL);
      if (res.status === 200) return await res.json();
      return {};
    } catch (e) {
      return {};
    }
  }

  async handleHttpRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);

    if (req.method === 'OPTIONS') {
      res.writeHead(200, CORS_HEADERS);
      res.end();
      return;
    }

    if (parsedUrl.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
      return;
    }

    if (parsedUrl.pathname === '/') {
      const currentHost = req.headers.host || 'localhost:3000';
      const protocolWs = req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
      const uptime = Math.floor(process.uptime());
      const ramUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

      res.writeHead(200, { 'Content-Type': 'text/html' });
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
    .neon-card:hover { border-color: #10b981; }
  </style>
</head>
<body class="min-h-screen pb-12">

  <!-- HEADER -->
  <header class="border-b border-slate-800 bg-[#0a0c16]/90 backdrop-blur sticky top-0 z-50 px-6 py-4">
    <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
          <i class="fa-solid fa-bolt text-lg"></i>
        </div>
        <div>
          <h1 class="text-lg font-bold tracking-wider text-white">KANCIL_VPN<span class="text-emerald-400">.sys</span></h1>
          <p class="text-[10px] text-slate-500">RAILWAY HIGH-SPEED RELAY NODE</p>
        </div>
      </div>
      <div class="flex items-center gap-2 bg-emerald-950/60 border border-emerald-800 px-4 py-1.5 rounded-lg">
        <span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
        <span class="text-xs font-semibold text-emerald-300">SERVER ONLINE</span>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-6 pt-8 space-y-6">

    <!-- STATS -->
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
        <p class="text-[10px] text-slate-500 font-bold mb-1">PROTOCOL</p>
        <p class="text-lg font-bold text-purple-400">VLESS / TROJAN</p>
      </div>
      <div class="neon-card p-4 rounded-xl">
        <p class="text-[10px] text-slate-500 font-bold mb-1">PORT TLS</p>
        <p class="text-lg font-bold text-amber-400">443</p>
      </div>
    </div>

    <!-- GENERATOR PANEL -->
    <div class="glow-box bg-[#0c0e18] rounded-2xl p-6">
      <div class="flex items-center gap-2 border-b border-slate-800 pb-3 mb-6">
        <i class="fa-solid fa-sliders text-emerald-400"></i>
        <h2 class="text-sm font-bold tracking-wide text-white">CONFIG GENERATOR</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div>
            <label class="text-xs text-slate-400 block mb-1">UUID / Password</label>
            <input id="uuid" type="text" value="c48619fe-8f02-49e0-b9e9-edf763e17e21" class="w-full bg-[#06070c] border border-slate-800 rounded-lg p-2.5 text-xs text-emerald-300 font-mono">
          </div>
          <div>
            <label class="text-xs text-slate-400 block mb-1">Host Domain</label>
            <input id="host" type="text" value="${currentHost}" class="w-full bg-[#06070c] border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono">
          </div>
          <div>
            <label class="text-xs text-slate-400 block mb-1">Pilih Server Target / Path</label>
            <select id="path" class="w-full bg-[#06070c] border border-slate-800 rounded-lg p-2.5 text-xs text-emerald-300 font-mono">
              <option value="/ID">🇮🇩 /ID (Indonesia)</option>
              <option value="/SG" selected>🇸🇬 /SG (Singapore)</option>
              <option value="/JP">🇯🇵 /JP (Japan)</option>
              <option value="/US">🇺🇸 /US (United States)</option>
              <option value="/ALL">🌍 /ALL (Rotate Global)</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-slate-400 block mb-1">SNI (Server Name Indication)</label>
            <input id="sni" type="text" value="${currentHost}" class="w-full bg-[#06070c] border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono">
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
            <textarea id="vless" readonly class="w-full bg-[#06070c] border border-slate-800 rounded-lg p-2.5 text-xs text-purple-300 font-mono h-24 resize-none"></textarea>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] text-amber-400 font-bold">TROJAN WS TLS</span>
              <button onclick="copyId('trojan')" class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">COPY</button>
            </div>
            <textarea id="trojan" readonly class="w-full bg-[#06070c] border border-slate-800 rounded-lg p-2.5 text-xs text-amber-300 font-mono h-24 resize-none"></textarea>
          </div>
        </div>
      </div>
    </div>

  </main>

  <script>
    function genAcc() {
      const u = document.getElementById('uuid').value.trim();
      const h = document.getElementById('host').value.trim();
      const p = document.getElementById('path').value.trim();
      const s = document.getElementById('sni').value.trim();
      
      const ep = encodeURIComponent(p);

      const v = \`vless://\${u}@\${h}:443?encryption=none&security=tls&sni=\${s}&type=ws&host=\${h}&path=\${ep}#Kancil-VLESS-\${p.replace('/','')}\`;
      const t = \`trojan://\${u}@\${h}:443?security=tls&sni=\${s}&type=ws&host=\${h}&path=\${ep}#Kancil-Trojan-\${p.replace('/','')}\`;

      document.getElementById('vless').value = v;
      document.getElementById('trojan').value = t;
    }

    function copyId(id) {
      const el = document.getElementById(id);
      el.select();
      navigator.clipboard.writeText(el.value);
      alert('Config disalin!');
    }

    window.onload = genAcc;
  </script>
</body>
</html>`);
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  }

  async handleWebSocketConnection(ws, request) {
    try {
      const parsedUrl = url.parse(request.url, true);
      const path = parsedUrl.pathname.toUpperCase();

      const kvPrx = await this.getKVPrxList();
      const countryKey = path.replace("/", "") || "SG";

      if (kvPrx[countryKey] && kvPrx[countryKey].length > 0) {
        this.prxIP = kvPrx[countryKey][Math.floor(Math.random() * kvPrx[countryKey].length)];
      } else {
        const allProxies = Object.values(kvPrx).flat();
        if (allProxies.length > 0) {
          this.prxIP = allProxies[Math.floor(Math.random() * allProxies.length)];
        } else {
          this.prxIP = "104.64.192.116:443"; // Fallback IP
        }
      }

      await this.websocketHandler(ws);
    } catch (err) {
      ws.close(1011, 'Internal Error');
    }
  }

  async websocketHandler(ws) {
    let remoteSocketWrapper = { value: null };

    ws.on('message', async (message) => {
      try {
        const chunk = Buffer.from(message);
        if (remoteSocketWrapper.value) {
          remoteSocketWrapper.value.write(chunk);
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

        this.handleTCPOutBound(remoteSocketWrapper, header.addressRemote, header.portRemote, header.rawClientData, ws, header.version);
      } catch (err) {
        ws.close(1011, err.message);
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

  async handleTCPOutBound(remoteSocket, addressRemote, portRemote, rawClientData, webSocket, responseHeader) {
    const connectAndWrite = (address, port) => new Promise((resolve, reject) => {
      const s = net.createConnection({ host: address, port }, () => {
        s.write(rawClientData);
        resolve(s);
      });
      s.on('error', reject);
    });

    const retry = async () => {
      try {
        const parts = this.prxIP.split(":");
        const s = await connectAndWrite(parts[0], parseInt(parts[1], 10) || 443);
        remoteSocket.value = s;
        s.on('close', () => webSocket.close());
        s.on('error', () => webSocket.close());
        this.remoteSocketToWS(s, webSocket, responseHeader, null);
      } catch (e) {
        webSocket.close();
      }
    };

    try {
      const s = await connectAndWrite(addressRemote, portRemote);
      remoteSocket.value = s;
      s.on('close', () => webSocket.close());
      s.on('error', () => webSocket.close());
      this.remoteSocketToWS(s, webSocket, responseHeader, retry);
    } catch (e) {
      await retry();
    }
  }

  async handleUDPOutbound(targetAddress, targetPort, dataChunk, webSocket, responseHeader) {
    try {
      let header = responseHeader;
      const key = `${targetAddress}:${targetPort}:${Date.now()}`;
      const sock = dgram.createSocket('udp4');
      this.activeUDPConnections.set(key, { socket: sock, webSocket });

      sock.send(dataChunk, targetPort, targetAddress, (e) => {
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
    return { hasError: false, addressRemote: av, portRemote: pr, rawDataIndex: pi+2, rawClientData: buf.slice(pi+2), version: null, isUDP: pr === 53 };
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

  remoteSocketToWS(remoteSocket, webSocket, responseHeader, retry) {
    let header = responseHeader, hasData = false;
    remoteSocket.on('data', (chunk) => {
      hasData = true;
      if (webSocket.readyState !== WebSocket.OPEN) { remoteSocket.destroy(); return; }
      if (header) {
        webSocket.send(Buffer.concat([Buffer.from(header), chunk]));
        header = null;
      } else {
        webSocket.send(chunk);
      }
    });
    remoteSocket.on('close', () => { if (!hasData && retry) retry(); });
  }

  start(port = PORT) {
    const server = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    this.wss = new WebSocket.Server({ server, perMessageDeflate: false });
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
