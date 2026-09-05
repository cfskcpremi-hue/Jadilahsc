const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const net = require('net');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SYSTEM_UUID = process.env.SYSTEM_UUID || "c48619fe-8f02-49e0-b9e9-edf763e17e21";

// Mapping Proxy Outbound Target
const PROXY_MAP = {
    "trojanws-deneva": "202.155.95.132:443",
    "vlessws-deneva": "202.155.95.132:443",
    "trojanws-akamai": "172.232.249.224:2053",
    "vlessws-akamai": "172.232.249.224:2053",
    "trojanws-pusat": "103.6.207.108:8080",
    "vlessws-pusat": "103.6.207.108:8080",
    "trojanws-sgakamai": "104.64.192.116:443",
    "vlessws-sgakamai": "104.64.192.116:443",
    "trojanws-amazon": "13.250.19.142:443",
    "vlessws-amazon": "13.250.19.142:443",
    "trojanws-contabo": "194.233.85.147:443",
    "vlessws-contabo": "194.233.85.147:443"
};

function generateHMAC(secret, message) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(message);
    return hmac.digest('hex').substring(0, 16);
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, perMessageDeflate: false });

function buildDashboardHTML(host, uuid) {
    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kancil VPN Railway</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { background-color: #060a0f; color: #e2e8f0; font-family: sans-serif; }</style>
</head>
<body class="min-h-screen p-6 max-w-xl mx-auto">
    <div class="bg-slate-900 p-6 rounded-2xl border border-emerald-500/30">
        <h1 class="text-xl font-bold text-emerald-400 mb-2">Kancil VPN Generator</h1>
        <p class="text-xs text-slate-400 mb-4">Host Domain: ${host}</p>

        <div class="space-y-4">
            <div>
                <label class="text-xs text-emerald-400 font-bold block mb-1">Pilih Protokol</label>
                <select id="protocolSelect" onchange="updateProxyOptions()" class="w-full bg-slate-950 p-2 text-sm rounded border border-slate-800 text-slate-200">
                    <option value="vlessws" selected>VLESS WS TLS (Port 443)</option>
                    <option value="trojanws">Trojan WS TLS (Port 443)</option>
                </select>
            </div>
            <div>
                <label class="text-xs text-emerald-400 font-bold block mb-1">Pilih Server Target</label>
                <select id="proxySelect" class="w-full bg-slate-950 p-2 text-sm rounded border border-slate-800 text-slate-200 font-mono"></select>
            </div>
            <button onclick="generateLinks()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2 rounded text-sm">
                Generate Link
            </button>
        </div>

        <div id="out" class="mt-4 hidden">
            <textarea id="generatedLink" readonly class="w-full bg-slate-950 p-3 text-xs font-mono text-emerald-300 h-28 rounded border border-slate-800 resize-none"></textarea>
            <button onclick="copyLink()" class="w-full bg-slate-800 text-emerald-400 py-1.5 rounded text-xs mt-2 border border-slate-700">Salin Link</button>
        </div>
    </div>

    <script>
        const currentHost = location.host.split(':')[0];
        const proxyKeys = ${JSON.stringify(Object.keys(PROXY_MAP))};

        function updateProxyOptions() {
            const proto = document.getElementById("protocolSelect").value;
            const select = document.getElementById("proxySelect");
            select.innerHTML = "";
            proxyKeys.filter(k => k.startsWith(proto)).forEach(k => {
                const opt = document.createElement("option");
                opt.value = k; opt.textContent = k;
                select.appendChild(opt);
            });
        }

        async function generateHMAC(secret, message) {
            const enc = new TextEncoder();
            const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
            const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
            return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
        }

        async function generateLinks() {
            const proto = document.getElementById("protocolSelect").value;
            const pathVal = document.getElementById("proxySelect").value;
            const uuid = "${uuid}";
            const exp = Math.floor(Date.now() / 1000) + (7 * 86400);
            const sig = await generateHMAC(uuid, \`\${pathVal}:\${uuid}:\${exp}\`);
            const finalPath = \`/\${pathVal}/\${exp}/\${sig}/\${uuid}\`;

            let res = "";
            if (proto === "vlessws") {
                res = \`vless://\${uuid}@\${currentHost}:443?encryption=none&security=tls&sni=\${currentHost}&type=ws&host=\${currentHost}&path=\${encodeURIComponent(finalPath)}#Kancil-\${pathVal}\`;
            } else {
                res = \`trojan://\${uuid}@\${currentHost}:443?path=\${encodeURIComponent(finalPath)}&security=tls&host=\${currentHost}&type=ws&sni=\${currentHost}#Kancil-\${pathVal}\`;
            }
            document.getElementById("generatedLink").value = res;
            document.getElementById("out").classList.remove("hidden");
        }

        function copyLink() {
            const input = document.getElementById("generatedLink");
            input.select();
            navigator.clipboard.writeText(input.value);
            alert("Berhasil disalin!");
        }

        window.onload = updateProxyOptions;
    </script>
</body>
</html>`;
}

app.get('/ping', (req, res) => res.send('pong'));
app.get(['/', '/dashboard'], (req, res) => {
    res.setHeader('content-type', 'text/html;charset=UTF-8');
    res.send(buildDashboardHTML(req.headers.host, SYSTEM_UUID));
});

// Sniffer sederhana untuk membaca payload awal VLESS/Trojan
function parseV2RayHeader(buffer) {
    if (buffer.length < 2) return buffer;
    // Cek header Trojan (CRLF di index 56-57)
    if (buffer.length >= 58 && buffer[56] === 0x0d && buffer[57] === 0x0a) {
        return buffer.slice(58);
    }
    // Cek header VLESS (Version 0)
    if (buffer[0] === 0) {
        const optLength = buffer[17];
        return buffer.slice(19 + optLength);
    }
    return buffer;
}

wss.on('connection', (ws, req) => {
    const rawPath = req.url.split('/')[1] || "";
    const targetProxy = PROXY_MAP[rawPath];
    
    if (!targetProxy) {
        ws.close(1000, "Invalid Target Path");
        return;
    }

    const [targetHost, targetPortStr] = targetProxy.split(":");
    const targetPort = parseInt(targetPortStr, 10);

    let clientSocket = null;
    let isConnected = false;
    const messageQueue = [];

    ws.on('message', (message) => {
        const chunk = Buffer.isBuffer(message) ? message : Buffer.from(message);

        if (!clientSocket) {
            const cleanPayload = parseV2RayHeader(chunk);

            // Buka socket TCP ke target outbound
            clientSocket = net.createConnection({ host: targetHost, port: targetPort }, () => {
                isConnected = true;
                clientSocket.write(cleanPayload);
                while (messageQueue.length > 0) {
                    clientSocket.write(messageQueue.shift());
                }
            });

            clientSocket.on('data', (data) => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(data);
                }
            });

            clientSocket.on('error', () => {
                ws.close();
                if (clientSocket) clientSocket.destroy();
            });

            clientSocket.on('close', () => ws.close());
        } else if (isConnected) {
            clientSocket.write(chunk);
        } else {
            messageQueue.push(chunk);
        }
    });

    ws.on('close', () => {
        if (clientSocket) clientSocket.destroy();
    });

    ws.on('error', () => {
        if (clientSocket) clientSocket.destroy();
    });
});

server.listen(PORT, () => {
    console.log(`Server Railway aktif pada port ${PORT}`);
});
