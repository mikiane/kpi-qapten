const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5089;
const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return { months: [] };
}
function saveData(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); }

function getCurrentMonth() {
    return new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
}
function getMonthKey() {
    return new Date().toISOString().slice(0, 7);
}

const data = loadData();
if (!data.months || data.months.length === 0) data.months = [];

function getFormData() {
    const now = getMonthKey();
    let month = data.months.find(m => m.monthKey === now);
    if (!month) {
        month = {
            monthKey: now,
            monthLabel: getCurrentMonth(),
            totalUsers: 0,       // total abonnés
            qaptenIA: 0,         // inclus dans totalUsers
            costPerSub: 0,
            serverCost: 0,
            instancesPerServer: 1,
            fixedCosts: 0,
            notes: ''
        };
        data.months.push(month);
        saveData(data);
    }
    return month;
}

function calculateMetrics(m) {
    const totalUsers = m.totalUsers || 0;
    const qaptenIA = m.qaptenIA || 0;
    const byok = totalUsers - qaptenIA;
    const mrr = (byok * 8) + (qaptenIA * 24);
    const ips = m.instancesPerServer || 1;
    const serverCount = totalUsers > 0 ? Math.ceil(totalUsers / ips) : 0;
    const infraCost = serverCount * m.serverCost + m.fixedCosts;
    const variableCost = qaptenIA * (m.costPerSub || 0);
    const totalCost = infraCost + variableCost;
    const margin = mrr > 0 ? ((mrr - totalCost) / mrr * 100) : 0;
    const profit = mrr - totalCost;
    return { mrr, serverCount, infraCost, variableCost, totalCost, margin, profit, totalUsers: m.totalUsers || 0 };
}

const server = http.createServer((req, res) => {
    const form = getFormData();
    const mt = calculateMetrics(form);

    const sorted = [...data.months].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    const rows = sorted.map(m => {
        const c = calculateMetrics(m);
        const byok = (m.totalUsers || 0) - (m.qaptenIA || 0);
        return `<tr>
            <td>${m.monthLabel}</td>
            <td>${m.totalUsers}</td>
            <td>${m.qaptenIA || 0}</td>
            <td>${byok}</td>
            <td>${c.mrr}€</td>
            <td>${m.serverCost}€</td>
            <td>${m.instancesPerServer}</td>
            <td>${(m.costPerSub || 0).toFixed(2)}€</td>
            <td>${c.variableCost.toFixed(0)}€</td>
            <td>${c.infraCost.toFixed(0)}€</td>
            <td style="color:#${c.margin>0?'2e7d32':'c62828'}">${c.margin.toFixed(1)}%</td>
            <td style="color:#${c.profit>0?'2e7d32':'c62828'}">${c.profit.toFixed(0)}€</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qapten KPI</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui;background:#f0f2f5;padding:20px;max-width:1200px;margin:0 auto}
h1{color:#1a1a2e;margin-bottom:16px}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px}
.metric{background:#fff;border-radius:8px;padding:16px;box-shadow:0 2px 6px rgba(0,0,0,.06);text-align:center}
.metric .val{font-size:1.8em;font-weight:700;color:#1976d2}
.metric .label{color:#888;font-size:.8em;margin-top:4px}
.form{background:#fff;border-radius:8px;padding:20px;box-shadow:0 2px 6px rgba(0,0,0,.06);margin-bottom:20px}
.form h2{margin-bottom:12px;font-size:1.1em}
.form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.form-group label{display:block;color:#555;font-size:.85em;margin-bottom:4px}
.form-group input{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:1em}
.form-group input:focus{outline:none;border-color:#1976d2}
.btn{background:#1976d2;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;margin-top:12px;font-size:.9em}
.btn:hover{background:#1565c0}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.06)}
th{background:#1a1a2e;color:#fff;padding:8px 6px;font-size:.78em;text-align:left}
td{padding:8px 6px;border-bottom:1px solid #f0f0f0;font-size:.85em}
tr:last-child td{border-bottom:none}
.toast{position:fixed;top:20px;right:20px;background:#4caf50;color:#fff;padding:12px 20px;border-radius:6px;display:none}
.cost-break{display:flex;gap:8px;margin-top:4px;font-size:.75em;color:#888}
.cost-break span{background:#f5f5f5;padding:2px 6px;border-radius:3px}
</style></head><body>
<h1>📊 Qapten KPI</h1>

<div class="metrics">
    <div class="metric"><div class="val" id="v_mrr">${mt.mrr}€</div><div class="label">MRR</div></div>
    <div class="metric"><div class="val" id="v_users">${form.totalUsers || 0}</div><div class="label">Total abonnés</div></div>
    <div class="metric"><div class="val">${form.qaptenIA || 0}</div><div class="label">Dont Qapten IA</div></div>
    <div class="metric"><div class="val" id="v_margin" style="color:#${mt.margin>0?'2e7d32':'c62828'}">${mt.margin.toFixed(1)}%</div><div class="label">Marge nette</div></div>
    <div class="metric"><div class="val" id="v_profit" style="color:#${mt.profit>0?'2e7d32':'c62828'}">${mt.profit.toFixed(0)}€</div><div class="label">Profit</div></div>
    <div class="metric"><div class="val">${mt.variableCost.toFixed(0)}€</div><div class="label">Coût variable</div><div class="cost-break"><span>${(form.costPerSub||0).toFixed(2)}€/ab</span><span>× ${form.qaptenIA || 0} ab.</span></div></div>
    <div class="metric"><div class="val">${mt.infraCost.toFixed(0)}€</div><div class="label">Infra + Fixes</div></div>
    <div class="metric"><div class="val">${mt.totalCost.toFixed(0)}€</div><div class="label">Coûts totaux</div></div>
</div>

<div class="form">
    <h2>Saisie — ${form.monthLabel}</h2>
    <div class="form-grid">
        <div class="form-group"><label>Total abonnés</label><input type="number" id="f_total" value="${form.totalUsers || 0}" min="0"></div>
        <div class="form-group"><label>Dont abonnés Qapten IA (24€/mo)</label><input type="number" id="f_qia" value="${form.qaptenIA || 0}" min="0"></div>
        <div class="form-group"><label>Coût par abonné Qapten (€/mo)</label><input type="number" id="f_cps" value="${form.costPerSub || ''}" min="0" step="0.01"></div>
        <div class="form-group"><label>Coût / serveur (€/mo)</label><input type="number" id="f_srv" value="${form.serverCost}" min="0"></div>
        <div class="form-group"><label>Instances / serveur</label><input type="number" id="f_ips" value="${form.instancesPerServer}" min="1"></div>
        <div class="form-group"><label>Coûts fixes (€/mo)</label><input type="number" id="f_fc" value="${form.fixedCosts}" min="0"></div>
        <div class="form-group"><label>Notes</label><input type="text" id="f_notes" value="${form.notes || ''}" placeholder="..."></div>
    </div>
    <button class="btn" onclick="save()">💾 Sauvegarder</button>
</div>

<h2 style="margin-bottom:12px">Historique</h2>
<table>
    <tr><th>Mois</th><th>Total</th><th>Dont QIA</th><th>BYOK seuls</th><th>MRR</th><th>Coût/srv</th><th>Inst./srv</th><th>Coût/abonné</th><th>Var.</th><th>Infra</th><th>Marge</th><th>Profit</th></tr>
    ${rows}
</table>
<div class="toast" id="toast">✅ Sauvegardé !</div>

<script>
function calc(){
    const total = +f_total.value || 0;
    const qia = +f_qia.value || 0;
    const byok = total - qia;
    const srv = +f_srv.value || 0;
    const ips = +f_ips.value || 1;
    const fc = +f_fc.value || 0;
    const cps = +f_cps.value || 0;
    const mrr = byok * 8 + qia * 24;
    const sc = total > 0 ? Math.ceil(total / ips) : 0;
    const infra = sc * srv + fc;
    const variable = qia * cps;
    const tc = infra + variable;
    const mg = mrr > 0 ? ((mrr - tc) / mrr * 100) : 0;
    document.getElementById('v_mrr').textContent = mrr + '€';
    document.getElementById('v_users').textContent = total;
    const mc = document.getElementById('v_margin');
    mc.textContent = mg.toFixed(1) + '%'; mc.style.color = mg > 0 ? '#2e7d32' : '#c62828';
    const pc = document.getElementById('v_profit');
    pc.textContent = (mrr - tc) + '€'; pc.style.color = (mrr - tc) > 0 ? '#2e7d32' : '#c62828';
}
['f_total','f_qia','f_cps','f_srv','f_ips','f_fc'].forEach(id => document.getElementById(id).addEventListener('input', calc));
async function save(){
    const body = {
        monthKey:'${form.monthKey}', monthLabel:'${form.monthLabel}',
        totalUsers: +f_total.value, qaptenIA: +f_qia.value,
        costPerSub: +f_cps.value, serverCost: +f_srv.value,
        instancesPerServer: +f_ips.value, fixedCosts: +f_fc.value,
        notes: f_notes.value
    };
    const r = await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(r.ok){const t=document.getElementById('toast');t.style.display='block';setTimeout(()=>t.style.display='none',2000);}
}
</script>
</body></html>`;

    if (req.url === '/api' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
    } else if (req.url === '/api/save' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            const m = JSON.parse(body);
            const idx = data.months.findIndex(x => x.monthKey === m.monthKey);
            if (idx >= 0) data.months[idx] = m; else data.months.push(m);
            saveData(data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        });
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    }
}).listen(PORT, () => console.log(`KPI Dashboard → :${PORT}`));
