const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const net = require('net');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SYSTEM_UUID = process.env.SYSTEM_UUID || "c48619fe-8f02-49e0-b9e9-edf763e17e21";

// Mapping IP Server Target
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
const wss = new WebSocketServer({ noServer: true });

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
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\nExpired Account');
        socket.destroy();
        return;
    }

    const expectedSig = generateHMAC(SYSTEM_UUID, `${rawPath}:${clientUid}:${exp}`);
    if (sig !== expectedSig) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\nInvalid Signature');
        socket.destroy();
        return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, rawPath);
    });
});

// Parser Header VLESS & Trojan agar tidak error di Railway
function parseV2RayHeader(buffer) {
    if (buffer.length < 2) return buffer;
    
    // Trojan Parser
    if (buffer.length >= 58 && buffer[56] === 0x0d && buffer[57] === 0x0a) {
        return buffer.slice(58);
    }

    // VLESS Parser
    if (buffer[0] === 0) {
        const optLength = buffer[17];
        return buffer.slice(19 + optLength);
    }

    return buffer;
}

wss.on('connection', (ws, req, rawPath) => {
    const targetProxy = PROXY_MAP[rawPath];
    if (!targetProxy) {
        ws.close();
        return;
    }

    const [targetHost, targetPortStr] = targetProxy.split(":");
    const targetPort = parseInt(targetPortStr, 10);

    let clientSocket = null;
    let isConnected = false;
    const messageQueue = [];

    ws.on('message', (data) => {
        const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);

        if (!clientSocket) {
            const cleanData = parseV2RayHeader(chunk);

            clientSocket = net.createConnection({ host: targetHost, port: targetPort }, () => {
                isConnected = true;
                clientSocket.write(cleanData);
                while (messageQueue.length > 0) {
                    clientSocket.write(messageQueue.shift());
                }
            });

            clientSocket.on('data', (remoteData) => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(remoteData);
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
    console.log(`Server Railway aktif port ${PORT}`);
});
