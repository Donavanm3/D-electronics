const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '$' + Number(n || 0).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2});
const ICON = {Phones:'📱',Laptops:'💻',Consoles:'🎮',Tablets:'📲',Accessories:'🎧'};
const icon = c => ICON[c] || '🔧';
let D, cat = 'All';

fetch('data.json?v=' + Date.now()).then(r => r.json()).then(d => { D = d; render(); });

function render() {
  const b = D.business;
  document.title = b.name;
  if (b.accent) document.documentElement.style.setProperty('--accent', b.accent);
  $('#bizName').textContent = b.name; $('#footName').textContent = b.name;
  $('#tagline').textContent = b.tagline; $('#yr').textContent = new Date().getFullYear();
  if (b.announcement) { $('#announce').hidden = false; $('#announce').textContent = b.announcement; }
  $('#statItems').textContent = D.products.filter(p => p.status !== 'sold').length;
  $('#statRepairs').textContent = D.repairs.filter(r => r.active).length;

  $('#catBar').innerHTML = ['All', ...D.categories].map(c =>
    `<button class="chip ${c === cat ? 'on' : ''}" data-c="${esc(c)}">${c === 'All' ? 'All' : icon(c) + ' ' + esc(c)}</button>`).join('');
  $('#catBar').onclick = e => { const c = e.target.dataset.c; if (c) { cat = c; render(); } };
  products();

  const groups = {};
  D.repairs.filter(r => r.active).forEach(r => (groups[r.device] ||= []).push(r));
  $('#repairList').innerHTML = Object.keys(groups).length ? Object.entries(groups).map(([dev, list]) => `
    <div class="rgroup"><h3>${icon(dev)} ${esc(dev)}</h3>${list.map(r => `
      <div class="ritem"><div>${esc(r.service)}<small>⏱ ${esc(r.time)}</small></div><div class="p">${esc(r.price)}</div></div>`).join('')}</div>`).join('')
    : '<div class="empty">Repair list coming soon.</div>';

  $('#faqList').innerHTML = D.faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  $('#info').innerHTML = `
    <div><span>Phone</span><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></div>
    <div><span>Email</span><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></div>
    <div><span>Address</span>${esc(b.address)}</div>
    <div style="border:0"><span>Hours</span>${esc(b.hours)}</div>`;
  $('#formDevice').innerHTML = ['Repair – general', ...D.categories.map(c => 'Repair – ' + c), 'Buying an item', 'Selling my device']
    .map(o => `<option>${esc(o)}</option>`).join('');
}

function products() {
  const q = $('#q').value.toLowerCase(), hide = $('#hideSold').checked, s = $('#sort').value;
  let list = D.products.filter(p => (cat === 'All' || p.category === cat) && (!hide || p.status !== 'sold')
    && (p.name + ' ' + p.description + ' ' + p.condition).toLowerCase().includes(q));
  list.sort((a, b) => s === 'low' ? a.price - b.price : s === 'high' ? b.price - a.price : (b.featured - a.featured));
  $('#products').innerHTML = list.length ? list.map(p => `
    <div class="card ${p.status === 'sold' ? 'sold' : ''}">
      <div class="img">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : icon(p.category)}
        ${p.status !== 'available' ? `<span class="badge ${esc(p.status)}">${p.status === 'sold' ? 'Sold' : 'On hold'}</span>` : p.featured ? '<span class="badge">Featured</span>' : ''}</div>
      <div class="body"><h3>${esc(p.name)}</h3><div class="cond">${esc(p.condition)}</div>
        <div class="desc">${esc(p.description)}</div>
        <div class="row"><span class="price">${money(p.price)}</span>
          ${p.status === 'available' ? `<button class="btn sm primary" onclick="ask('${esc(p.id)}')">I want this</button>` : ''}</div></div>
    </div>`).join('') : '<div class="empty">No items match.</div>';
}
['#q', '#hideSold', '#sort'].forEach(s => $(s).addEventListener('input', products));

function ask(id) {
  const p = D.products.find(x => x.id === id);
  $('#formDevice').value = 'Buying an item';
  $('#quoteForm').msg.value = `Hi, I'm interested in the ${p.name} (${money(p.price)}). Is it still available?`;
  location.hash = 'contact';
}

$('#quoteForm').onsubmit = e => {
  e.preventDefault();
  const f = e.target, body = `Name: ${f.name.value}\nContact: ${f.contact.value}\nTopic: ${f.device.value}\n\n${f.msg.value}`;
  location.href = `mailto:${D.business.email}?subject=${encodeURIComponent(f.device.value + ' – website request')}&body=${encodeURIComponent(body)}`;
};
