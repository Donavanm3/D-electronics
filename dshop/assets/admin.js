const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const KEY = 'dshop_admin';
let cfg = null, D = null, sha = null, dirty = false, view = 'products', offline = false;

function toast(m) { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', 2600); }
function mark() { dirty = true; $('#saveStatus').textContent = '● Unpublished changes'; $('#saveStatus').className = 'status dirty'; }
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

// ---------- GitHub storage ----------
const api = p => `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${p}`;
const hdr = () => ({ Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json' });
const b64 = s => btoa(unescape(encodeURIComponent(s)));
const unb64 = s => decodeURIComponent(escape(atob(s.replace(/\n/g, ''))));

async function load() {
  const r = await fetch(api('data.json') + '?ref=' + cfg.branch + '&t=' + Date.now(), { headers: hdr() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Bad token' : r.status === 404 ? 'Repo or data.json not found' : 'GitHub error ' + r.status);
  const j = await r.json(); sha = j.sha; D = JSON.parse(unb64(j.content));
}
async function save() {
  if (offline) { download(); return; }
  $('#saveBtn').disabled = true; $('#saveStatus').textContent = 'Publishing…';
  try {
    const r = await fetch(api('data.json'), { method: 'PUT', headers: hdr(), body: JSON.stringify({
      message: 'Update shop data via admin panel', branch: cfg.branch, sha, content: b64(JSON.stringify(D, null, 2)) }) });
    if (r.status === 409) throw new Error('File changed elsewhere — reload the page');
    if (!r.ok) throw new Error('Save failed (' + r.status + ')');
    sha = (await r.json()).content.sha; dirty = false;
    $('#saveStatus').textContent = 'Published ✓ (site updates in ~1 min)'; $('#saveStatus').className = 'status';
    toast('Published to GitHub');
  } catch (e) { $('#saveStatus').textContent = e.message; toast(e.message); }
  $('#saveBtn').disabled = false;
}
async function uploadImage(file) {
  if (offline) throw new Error('Image upload needs GitHub sign-in — paste an image URL instead');
  const data = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(file); });
  const path = 'images/' + Date.now() + '-' + file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  const r = await fetch(api(path), { method: 'PUT', headers: hdr(), body: JSON.stringify({ message: 'Upload ' + path, branch: cfg.branch, content: data }) });
  if (!r.ok) throw new Error('Upload failed (' + r.status + ')');
  return path;
}
function download() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' }));
  a.download = 'data.json'; a.click();
  dirty = false; $('#saveStatus').textContent = 'Downloaded — upload data.json to your repo'; $('#saveStatus').className = 'status';
}

// ---------- auth ----------
$('#loginForm').onsubmit = async e => {
  e.preventDefault(); const f = e.target;
  cfg = { owner: f.owner.value.trim(), repo: f.repo.value.trim(), branch: f.branch.value.trim(), token: f.token.value.trim() };
  $('#loginMsg').textContent = 'Connecting…';
  try { await load(); localStorage.setItem(KEY, JSON.stringify(cfg)); start(); }
  catch (err) { $('#loginMsg').textContent = '❌ ' + err.message; }
};
$('#offlineBtn').onclick = async () => {
  offline = true; D = await (await fetch('data.json?t=' + Date.now())).json();
  $('#saveBtn').textContent = 'Download data.json'; start();
};
$('#logout').onclick = () => { if (!dirty || confirm('Discard unpublished changes?')) { localStorage.removeItem(KEY); location.reload(); } };
(async () => {
  try { cfg = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (cfg) { try { await load(); start(); } catch (e) { $('#loginMsg').textContent = '❌ ' + e.message; } }
})();
function start() { $('#loginView').hidden = true; $('#appView').hidden = false; render(); }

$('aside').onclick = e => { const v = e.target.dataset.v; if (!v) return; view = v;
  document.querySelectorAll('aside a').forEach(a => a.classList.toggle('on', a.dataset.v === v)); render(); };
$('#saveBtn').onclick = save;

// ---------- modal form helper ----------
function form(title, fields, obj, onSave) {
  $('#modalBody').innerHTML = `<h3 style="margin-top:0">${title}</h3><form class="grid2" id="mf">${fields.map(f => {
    const v = obj[f.k] ?? '';
    const input = f.type === 'select' ? `<select name="${f.k}">${f.opts.map(o => `<option ${o == v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : f.type === 'textarea' ? `<textarea name="${f.k}" rows="3">${esc(v)}</textarea>`
      : f.type === 'check' ? `<input type="checkbox" name="${f.k}" ${v ? 'checked' : ''} style="width:auto">`
      : `<input name="${f.k}" type="${f.type || 'text'}" value="${esc(v)}" ${f.req ? 'required' : ''} ${f.type === 'number' ? 'step="0.01" min="0"' : ''}>`;
    return `<label class="f ${f.full ? 'full' : ''}">${f.label}${input}${f.k === 'image' ? '<input type="file" accept="image/*" id="imgFile" style="margin-top:6px"><img id="imgPrev" style="max-height:120px;border-radius:8px;margin-top:6px">' : ''}</label>`;
  }).join('')}<div class="full" style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" id="mfCancel">Cancel</button><button class="btn primary">Save</button></div></form>`;
  $('#modal').classList.add('open');
  const prev = $('#imgPrev'); if (prev) { const upd = () => { const v = $('#mf').image.value; prev.src = v; prev.style.display = v ? 'block' : 'none'; }; upd();
    $('#mf').image.oninput = upd;
    $('#imgFile').onchange = async ev => { const file = ev.target.files[0]; if (!file) return; toast('Uploading image…');
      try { $('#mf').image.value = await uploadImage(file); prev.src = URL.createObjectURL(file); prev.style.display = 'block'; toast('Image uploaded'); } catch (er) { toast(er.message); } }; }
  $('#mfCancel').onclick = () => $('#modal').classList.remove('open');
  $('#mf').onsubmit = e => { e.preventDefault(); const f = e.target;
    fields.forEach(x => obj[x.k] = x.type === 'check' ? f[x.k].checked : x.type === 'number' ? parseFloat(f[x.k].value) || 0 : f[x.k].value.trim());
    onSave(obj); $('#modal').classList.remove('open'); mark(); render(); };
}
const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; mark(); render(); };
const del = (arr, i, name) => { if (confirm('Delete "' + name + '"?')) { arr.splice(i, 1); mark(); render(); } };

// ---------- views ----------
const V = {
  products() {
    const pf = () => [
      { k: 'name', label: 'Item name', req: 1, full: 1 },
      { k: 'category', label: 'Category', type: 'select', opts: D.categories },
      { k: 'price', label: 'Price ($)', type: 'number' },
      { k: 'condition', label: 'Condition', type: 'select', opts: ['New', 'Refurbished – Excellent', 'Refurbished – Good', 'Used – Like New', 'Used – Good', 'Used – Fair', 'For parts'] },
      { k: 'status', label: 'Listing status', type: 'select', opts: ['available', 'pending', 'sold'] },
      { k: 'description', label: 'Description', type: 'textarea', full: 1 },
      { k: 'image', label: 'Image (URL or upload)', full: 1 },
      { k: 'featured', label: 'Featured on top', type: 'check' }];
    window.editP = i => form('Edit item', pf(), D.products[i], () => {});
    window.addP = () => form('New item', pf(), { id: uid('p'), status: 'available', category: D.categories[0], condition: 'Refurbished – Good', price: 0 }, o => D.products.unshift(o));
    window.setStatus = (i, s) => { D.products[i].status = s; mark(); render(); };
    window.dupP = i => { D.products.splice(i + 1, 0, { ...D.products[i], id: uid('p'), name: D.products[i].name + ' (copy)' }); mark(); render(); };
    const sold = D.products.filter(p => p.status === 'sold').length;
    return `<div class="head"><h2>Shop items</h2><span class="status">${D.products.length} total · ${sold} sold</span><button class="btn primary" onclick="addP()">+ Add item</button></div>
    <table><tr><th></th><th>Item</th><th class="hide-m">Category</th><th>Price</th><th>Status</th><th></th></tr>
    ${D.products.map((p, i) => `<tr><td><div class="thumb">${p.image ? `<img class="thumb" src="${esc(p.image)}">` : '📦'}</div></td>
      <td><b>${esc(p.name)}</b>${p.featured ? ' ⭐' : ''}<br><span class="status">${esc(p.condition)}</span></td>
      <td class="hide-m">${esc(p.category)}</td><td>$${p.price}</td>
      <td><select style="width:auto;padding:4px 8px" onchange="setStatus(${i},this.value)">${['available', 'pending', 'sold'].map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      <td style="white-space:nowrap"><button class="btn sm" onclick="editP(${i})">Edit</button> <button class="btn sm" onclick="dupP(${i})" title="Duplicate">⧉</button> <button class="btn sm danger" onclick="del(D.products,${i},'${esc(p.name).replace(/'/g, '')}')">✕</button></td></tr>`).join('')}
    </table>${D.products.length ? '' : '<div class="empty">No items yet.</div>'}`;
  },
  repairs() {
    const rf = () => [
      { k: 'device', label: 'Device type', type: 'select', opts: D.categories },
      { k: 'service', label: 'Service', req: 1 },
      { k: 'price', label: 'Price text (e.g. "from $79", "Quote")' },
      { k: 'time', label: 'Turnaround' },
      { k: 'active', label: 'Show on site', type: 'check' }];
    window.editR = i => form('Edit repair service', rf(), D.repairs[i], () => {});
    window.addR = () => form('New repair service', rf(), { id: uid('r'), device: D.categories[0], active: true }, o => D.repairs.push(o));
    window.togR = i => { D.repairs[i].active = !D.repairs[i].active; mark(); render(); };
    return `<div class="head"><h2>What you repair</h2><button class="btn primary" onclick="addR()">+ Add service</button></div>
    <table><tr><th>Device</th><th>Service</th><th>Price</th><th class="hide-m">Time</th><th>Shown</th><th></th></tr>
    ${D.repairs.map((r, i) => `<tr style="${r.active ? '' : 'opacity:.5'}"><td>${esc(r.device)}</td><td><b>${esc(r.service)}</b></td><td>${esc(r.price)}</td><td class="hide-m">${esc(r.time)}</td>
      <td><input type="checkbox" style="width:auto" ${r.active ? 'checked' : ''} onchange="togR(${i})"></td>
      <td style="white-space:nowrap"><button class="btn sm" onclick="move(D.repairs,${i},-1)">↑</button> <button class="btn sm" onclick="move(D.repairs,${i},1)">↓</button> <button class="btn sm" onclick="editR(${i})">Edit</button> <button class="btn sm danger" onclick="del(D.repairs,${i},'${esc(r.service).replace(/'/g, '')}')">✕</button></td></tr>`).join('')}</table>`;
  },
  categories() {
    window.addC = () => { const v = $('#newCat').value.trim(); if (v && !D.categories.includes(v)) { D.categories.push(v); mark(); render(); } };
    window.delC = i => { const c = D.categories[i], used = D.products.some(p => p.category === c) || D.repairs.some(r => r.device === c);
      if (confirm(used ? `"${c}" is still used by items/repairs. Delete anyway?` : `Delete "${c}"?`)) { D.categories.splice(i, 1); mark(); render(); } };
    return `<div class="head"><h2>Categories</h2></div><p class="sub">Used for shop filters and repair groups.</p>
    <div class="chiplist">${D.categories.map((c, i) => `<span>${esc(c)}<button onclick="move(D.categories,${i},-1)" style="color:var(--muted)">←</button><button onclick="delC(${i})">✕</button></span>`).join('')}</div>
    <div style="display:flex;gap:10px;max-width:400px"><input id="newCat" placeholder="New category" onkeydown="if(event.key==='Enter')addC()"><button class="btn primary" onclick="addC()">Add</button></div>`;
  },
  business() {
    const b = D.business, F = [['name', 'Business name'], ['tagline', 'Tagline'], ['announcement', 'Top banner (blank to hide)'], ['phone', 'Phone'], ['email', 'Email (receives quote requests)'], ['address', 'Address'], ['hours', 'Hours']];
    window.setB = (k, v) => { b[k] = v; mark(); };
    return `<div class="head"><h2>Business info</h2></div><div class="box grid2">
      ${F.map(([k, l]) => `<label class="f ${['tagline', 'announcement', 'hours'].includes(k) ? 'full' : ''}">${l}<input value="${esc(b[k])}" oninput="setB('${k}',this.value)"></label>`).join('')}
      <label class="f">Accent color<input type="color" value="${esc(b.accent || '#22d3ee')}" style="height:44px;padding:4px" oninput="setB('accent',this.value)"></label></div>`;
  },
  faq() {
    const ff = [{ k: 'q', label: 'Question', req: 1, full: 1 }, { k: 'a', label: 'Answer', type: 'textarea', full: 1 }];
    window.editF = i => form('Edit FAQ', ff, D.faq[i], () => {});
    window.addF = () => form('New FAQ', ff, {}, o => D.faq.push(o));
    return `<div class="head"><h2>FAQ</h2><button class="btn primary" onclick="addF()">+ Add question</button></div>
    ${D.faq.map((f, i) => `<div class="box" style="margin-bottom:10px;display:flex;gap:12px;align-items:start"><div style="flex:1"><b>${esc(f.q)}</b><p class="status" style="margin:6px 0 0">${esc(f.a)}</p></div>
      <button class="btn sm" onclick="move(D.faq,${i},-1)">↑</button><button class="btn sm" onclick="editF(${i})">Edit</button><button class="btn sm danger" onclick="del(D.faq,${i},'this question')">✕</button></div>`).join('')}`;
  },
  backup() {
    window.importJ = async inp => { try { const d = JSON.parse(await inp.files[0].text()); if (!d.products || !d.business) throw 0; D = d; mark(); render(); toast('Imported — press Publish'); } catch { toast('Invalid file'); } };
    return `<div class="head"><h2>Backup</h2></div><div class="box"><p class="sub">Download a copy of all your shop data, or restore from one.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" onclick="download()">⬇ Download data.json</button>
      <label class="btn">⬆ Import file<input type="file" accept=".json" hidden onchange="importJ(this)"></label></div></div>`;
  }
};
function render() { $('#view').innerHTML = V[view](); }
