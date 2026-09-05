const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const net = require('net');
const dgram = require('dgram');
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
    <title>Kancil VPN Railway</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { background-color: #060a0f; color: #e2e8f0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont; }
        .glass { background: rgba(11, 22, 17, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(16, 185, 129, 0.2); }
    </style>
</head>
<body class="min-h-screen pb-12">
    <div class="max-w-4xl mx-auto px-4 pt-8">
        <div class="glass rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">Kancil VPN Railway</h1>
                <p class="text-emerald-400/70 text-sm mt-1">Host Domain: <span class="text-emerald-300 font-mono">${host}</span></p>
            </div>
            <div id="statusBadge" class="flex items-center gap-2 bg-emerald-950/80 px-4 py-2 rounded-xl border border-emerald-800">
                <span class="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
                <span class="text-xs font-semibold text-emerald-200">Server Online</span>
            </div>
        </div>

        <div class="glass rounded-2xl p-6 mb-8">
            <h2 class="text-lg font-semibold text-emerald-300 mb-4 flex items-center gap-2">
                <i class="fa-solid fa-sliders text-emerald-400"></i> Generator Config
            </h2>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-xs font-medium text-emerald-400/80 mb-1">Username / Remark</label>
                    <input type="text" id="userRemark" value="Kancil-VPN" class="w-full bg-slate-950 border border-emerald-900 rounded-xl px-4 py-2 text-sm text-emerald-200 font-mono">
                </div>
                <div>
                    <label class="block text-xs font-medium text-emerald-400/80 mb-1">Masa Aktif</label>
                    <select id="activePeriod" class="w-full bg-slate-950 border border-emerald-900 rounded-xl px-4 py-2 text-sm text-emerald-100 font-mono">
                        <option value="7d" selected>7 Hari</option>
                        <option value="30d">30 Hari</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-xs font-medium text-emerald-400/80 mb-1">Pilih Protokol</label>
                    <select id="protocolSelect" onchange="updateProxyOptions()" class="w-full bg-slate-950 border border-emerald-900 rounded-xl px-4 py-2 text-sm text-emerald-100 font-mono">
                        <option value="vlessws" selected>VLESS WS TLS (Port 443)</option>
                        <option value="trojanws">Trojan WS TLS (Port 443)</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-medium text-emerald-400/80 mb-1">Pilih Server Target</label>
                    <select id="proxySelect" onchange="syncPathInput()" class="w-full bg-slate-950 border border-emerald-900 rounded-xl px-4 py-2 text-sm text-emerald-100 font-mono"></select>
                </div>
            </div>

            <div class="mb-4">
                <label class="block text-xs font-medium text-emerald-400/80 mb-1">Path Target</label>
                <input type="text" id="proxyIp" class="w-full bg-slate-950 border border-emerald-900 rounded-xl px-4 py-2 text-sm text-emerald-200 font-mono">
            </div>

            <div class="mb-4">
                <input type="hidden" id="userUuid" value="${uuid}">
            </div>

            <button onclick="generateLinks()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-xl text-sm">
                Generate Config Link
            </button>
        </div>

        <div id="outputContainer" class="hidden space-y-4">
            <div class="glass rounded-2xl p-5">
                <div class="flex items-center justify-between mb-2">
                    <span id="outputTitle" class="text-xs font-bold text-emerald-400">HASIL CONFIG</span>
                    <button onclick="copyToClipboard('generatedLink')" class="text-xs text-emerald-300 bg-emerald-950 border border-emerald-800 px-3 py-1 rounded-lg">
                        <i class="fa-regular fa-copy"></i> Salin Link
                    </button>
                </div>
                <textarea id="generatedLink" readonly rows="5" class="w-full bg-slate-950/60 border border-emerald-950 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 resize-none"></textarea>
            </div>
        </div>
    </div>

    <script>
        const currentHost = location.host.split(':')[0];
        const SYSTEM_KEY = "${uuid}";

        const proxyData = {
            "ID": [
                { name: "deneva", target: "202.155.95.132:443" },
                { name: "akamai", target: "172.232.249.224:2053" },
                { name: "pusat", target: "103.6.207.108:8080" }
            ],
            "SG": [
                { name: "sgakamai", target: "104.64.192.116:443" },
                { name: "amazon", target: "13.250.19.142:443" },
                { name: "contabo", target: "194.233.85.147:443" },
                { name: "oracle", target: "138.2.64.229:443" },
                { name: "ovh", target: "51.79.177.53:443" }
            ]
        };

        async function generateHMAC(secret, message) {
            const enc = new TextEncoder();
            const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
            const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
            return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
        }

        function updateProxyOptions() {
            const proto = document.getElementById("protocolSelect").value;
            const select = document.getElementById("proxySelect");
            select.innerHTML = "";
            for (const [region, items] of Object.entries(proxyData)) {
                const optGroup = document.createElement("optgroup");
                optGroup.label = region;
                items.forEach(item => {
                    const fullPath = proto + "-" + item.name;
                    const option = document.createElement("option");
                    option.value = fullPath;
                    option.textContent = fullPath;
                    optGroup.appendChild(option);
                });
                select.appendChild(optGroup);
            }
            syncPathInput();
        }

        function syncPathInput() {
            document.getElementById("proxyIp").value = document.getElementById("proxySelect").value;
        }

        async function generateLinks() {
            const proto = document.getElementById("protocolSelect").value;
            const pathVal = document.getElementById("proxyIp").value.trim();
            const uuid = document.getElementById("userUuid").value.trim();
            const rawRemark = document.getElementById("userRemark").value.trim() || "Kancil-VPN";
            
            const exp = Math.floor(Date.now() / 1000) + (7 * 86400);
            const expDate = new Date(exp * 1000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
            const remarkTag = \`\${rawRemark}[\${expDate}]\`;

            const sig = await generateHMAC(SYSTEM_KEY, \`\${pathVal}:\${uuid}:\${exp}\`);
            const finalPathQuery = \`/\${pathVal}/\${exp}/\${sig}/\${uuid}\`;

            let resultLink = "";
            if (proto === "vlessws") {
                resultLink = \`vless://\${uuid}@\${currentHost}:443?encryption=none&security=tls&sni=\${currentHost}&type=ws&host=\${currentHost}&path=\${encodeURIComponent(finalPathQuery)}#\${encodeURIComponent(remarkTag)}-\${pathVal}\`;
            } else {
                resultLink = \`trojan://\${uuid}@\${currentHost}:443?path=\${encodeURIComponent(finalPathQuery)}&security=tls&host=\${currentHost}&type=ws&sni=\${currentHost}#\${encodeURIComponent(remarkTag)}-\${pathVal}\`;
            }

            document.getElementById("outputTitle").textContent = proto.toUpperCase() + " CONFIG";
            document.getElementById("generatedLink").value = resultLink;
            document.getElementById("outputContainer").classList.remove("hidden");
        }

        function copyToClipboard(id) {
            const input = document.getElementById(id);
            input.select();
            navigator.clipboard.writeText(input.value);
            alert("Disalin!");
        }

        window.onload = function() {
            updateProxyOptions();
        };
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

    let rawPath = segments[0] || "";
    let exp = parseInt(segments[1] || "0", 10);
    let sig = segments[2] || "";
    let clientUid = segments[3] || "";

    if (!exp) exp = parseInt(url.searchParams.get("exp") || "0", 10);
    if (!sig) sig = url.searchParams.get("sig") || "";
    if (!clientUid) clientUid = url.searchParams.get("uid") || "";

    const now = Math.floor(Date.now() / 1000);

    if (!exp || !sig || now > exp) {
        socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nExpired Account');
        socket.destroy();
        return;
    }

    const expectedSig = generateHMAC(SYSTEM_UUID, `${rawPath}:${clientUid}:${exp}`);
    if (sig !== expectedSig) {
        socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nInvalid Token');
        socket.destroy();
        return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, rawPath);
    });
});

wss.on('connection', (ws, req, rawPath) => {
    let targetProxy = PROXY_MAP[rawPath] || null;
    if (!targetProxy) {
        const pathMatch = rawPath.match(/^(.+[:=-]\d+)$/);
        if (pathMatch) targetProxy = pathMatch[1].replace("-", ":");
    }

    if (!targetProxy) {
        ws.close();
        return;
    }

    const [targetHost, targetPort] = targetProxy.split(":");
    let isConnected = false;
    const messageQueue = [];

    // Buka koneksi TCP Socket ke VPS Target
    const clientSocket = net.connect(parseInt(targetPort, 10), targetHost, () => {
        isConnected = true;
        // Kirim semua data yang terkumpul selama proses handshake
        while (messageQueue.length > 0) {
            const data = messageQueue.shift();
            clientSocket.write(data);
        }
    });

    ws.on('message', (data) => {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (isConnected) {
            clientSocket.write(buffer);
        } else {
            messageQueue.push(buffer);
        }
    });

    clientSocket.on('data', (chunk) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(chunk);
        }
    });

    clientSocket.on('error', () => {
        ws.close();
        clientSocket.destroy();
    });

    clientSocket.on('close', () => ws.close());
    ws.on('close', () => clientSocket.destroy());
    ws.on('error', () => clientSocket.destroy());
});

server.listen(PORT, () => {
    console.log(`Server Railway aktif pada port ${PORT}`);
});