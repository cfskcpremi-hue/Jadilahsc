const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SYSTEM_UUID = process.env.SYSTEM_UUID || "c48619fe-8f02-49e0-b9e9-edf763e17e21";

function generateHMAC(secret, message) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(message);
    return hmac.digest('hex').substring(0, 16);
}

const PROXY_MAP = {
    "trojanws-deneva": "202.155.95.132:443",
    "vlessws-deneva": "202.155.95.132:443",
    "vmessws-deneva": "202.155.95.132:443",
    "trojanws-akamai": "172.232.249.224:2053",
    "vlessws-akamai": "172.232.249.224:2053",
    "vmessws-akamai": "172.232.249.224:2053",
    "trojanws-pusat": "103.6.207.108:8080",
    "vlessws-pusat": "103.6.207.108:8080",
    "vmessws-pusat": "103.6.207.108:8080",
    "trojanws-sgakamai": "104.64.192.116:443",
    "vlessws-sgakamai": "104.64.192.116:443",
    "vmessws-sgakamai": "104.64.192.116:443",
    "trojanws-amazon": "13.250.19.142:443",
    "vlessws-amazon": "13.250.19.142:443",
    "vmessws-amazon": "13.250.19.142:443",
    "trojanws-contabo": "194.233.85.147:443",
    "vlessws-contabo": "194.233.85.147:443",
    "vmessws-contabo": "194.233.85.147:443",
    "trojanws-oracle": "138.2.64.229:443",
    "vlessws-oracle": "138.2.64.229:443",
    "vmessws-oracle": "138.2.64.229:443",
    "trojanws-ovh": "51.79.177.53:443",
    "vlessws-ovh": "51.79.177.53:443",
    "vmessws-ovh": "51.79.177.53:443"
};

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

function buildDashboardHTML(host, uuid) {
    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kancil VPN Railway Server</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { background-color: #060a0f; color: #e2e8f0; font-family: ui-sans-serif, system-ui; }</style>
</head>
<body class="min-h-screen p-8 max-w-2xl mx-auto">
    <div class="bg-slate-900 p-6 rounded-2xl border border-emerald-500/30">
        <h1 class="text-xl font-bold text-emerald-400 mb-2">Kancil VPN Railway Dashboard</h1>
        <p class="text-xs text-slate-400 mb-4">Host: ${host}</p>
        
        <div class="space-y-3">
            <div>
                <label class="text-xs text-emerald-400">Pilih Server Target</label>
                <select id="proxySelect" class="w-full bg-slate-950 p-2 text-sm rounded border border-slate-800 text-slate-200 font-mono"></select>
            </div>
            <div>
                <label class="text-xs text-emerald-400">Protokol</label>
                <select id="protoSelect" class="w-full bg-slate-950 p-2 text-sm rounded border border-slate-800 text-slate-200 font-mono">
                    <option value="vless">VLESS WS TLS (Port 443)</option>
                    <option value="trojan">Trojan WS TLS (Port 443)</option>
                </select>
            </div>
            <button onclick="gen()" class="w-full bg-emerald-600 text-slate-950 font-bold p-2.5 rounded text-sm mt-4">Generate Link</button>
        </div>

        <div id="out" class="mt-4 hidden">
            <textarea id="link" readonly class="w-full bg-slate-950 p-2 text-xs font-mono text-emerald-300 h-24 rounded border border-slate-800"></textarea>
        </div>
    </div>

    <script>
        const host = location.host.split(':')[0];
        const proxyData = ${JSON.stringify(Object.keys(PROXY_MAP))};
        const select = document.getElementById("proxySelect");
        proxyData.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p; opt.textContent = p;
            select.appendChild(opt);
        });

        async function generateHMAC(secret, message) {
            const enc = new TextEncoder();
            const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
            const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
            return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
        }

        async function gen() {
            const p = select.value;
            const proto = document.getElementById("protoSelect").value;
            const uuid = "${uuid}";
            const exp = Math.floor(Date.now()/1000) + 604800;
            const sig = await generateHMAC(uuid, \`\${p}:\${uuid}:\${exp}\`);
            const path = encodeURIComponent(\`/\${p}/\${exp}/\${sig}/\${uuid}\`);
            
            let res = "";
            if (proto === "vless") {
                res = \`vless://\${uuid}@\${host}:443?encryption=none&security=tls&sni=\${host}&type=ws&host=\${host}&path=\${path}#Kancil-\${p}\`;
            } else {
                res = \`trojan://\${uuid}@\${host}:443?path=\${path}&security=tls&host=\${host}&type=ws&sni=\${host}#Kancil-\${p}\`;
            }
            document.getElementById("link").value = res;
            document.getElementById("out").classList.remove("hidden");
        }
    </script>
</body>
</html>`;
}

app.get('/ping', (req, res) => res.send('pong'));
app.get(['/', '/dashboard'], (req, res) => {
    res.setHeader('content-type', 'text/html;charset=UTF-8');
    res.send(buildDashboardHTML(req.headers.host, SYSTEM_UUID));
});

server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const segments = url.pathname.split('/').filter(Boolean);

    const rawPath = segments[0] || "";
    let exp = parseInt(segments[1] || "0", 10);
    let sig = segments[2] || "";
    let clientUid = segments[3] || "";

    if (!exp) exp = parseInt(url.searchParams.get("exp") || "0", 10);
    if (!sig) sig = url.searchParams.get("sig") || "";
    if (!clientUid) clientUid = url.searchParams.get("uid") || "";

    const now = Math.floor(Date.now() / 1000);

    if (!exp || !sig || now > exp) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\nExpired');
        socket.destroy();
        return;
    }

    const expectedSig = generateHMAC(SYSTEM_UUID, `${rawPath}:${clientUid}:${exp}`);
    if (sig !== expectedSig) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\nInvalid Token');
        socket.destroy();
        return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, rawPath);
    });
});

wss.on('connection', (ws, req, rawPath) => {
    const targetProxy = PROXY_MAP[rawPath];
    if (!targetProxy) {
        ws.close();
        return;
    }

    const [targetHost, targetPortStr] = targetProxy.split(":");
    const targetPort = parseInt(targetPortStr, 10);

    // Bedakan penanganan port TLS vs Non-TLS
    const isTlsPort = [443, 2053, 8443, 2083, 2096].includes(targetPort);
    
    let targetSocket;

    if (isTlsPort) {
        // Menggunakan TLS Stream Passthrough untuk menghindari handshake error
        targetSocket = tls.connect(targetPort, targetHost, { rejectUnauthorized: false }, () => {
            ws.on('message', (chunk) => {
                if (targetSocket.writable) targetSocket.write(chunk);
            });
        });
    } else {
        targetSocket = net.connect(targetPort, targetHost, () => {
            ws.on('message', (chunk) => {
                if (targetSocket.writable) targetSocket.write(chunk);
            });
        });
    }

    targetSocket.on('data', (data) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
    });

    targetSocket.on('error', () => ws.close());
    targetSocket.on('close', () => ws.close());
    ws.on('close', () => targetSocket.destroy());
    ws.on('error', () => targetSocket.destroy());
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
