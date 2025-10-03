
const state = {
  products: [], cart: {}, lang: 'en', dict: {}
};

async function loadI18n(lang) {
  const res = await fetch(`i18n/${lang}.json`);
  state.dict = await res.json();
  state.lang = lang;
  applyI18n();
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = key.split('.').reduce((o,k)=>o && o[k], state.dict);
    if (val) el.textContent = val;
  });
  document.title = (state.dict.title && state.dict.title[document.querySelector('title').getAttribute('data-i18n').split('.')[1]]) || document.title;
}

async function loadProducts() {
  try {
    const res = await fetch('products.json');
    state.products = await res.json();
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    grid.innerHTML = state.products.map(p => `
      <div class="product-card">
        <img src="${p.image || ''}" alt="${p.name}">
        <div class="pad">
          <h3>${p.name}</h3>
          <div class="price">$${p.price.toLocaleString()}</div>
          <p>${p.description || ''}</p>
          <button class="btn primary" onclick="addToCart('${p.sku}')">${state.dict.home?.cta_shop || 'Add to Cart'}</button>
        </div>
      </div>`).join('');
  } catch(e) { console.error(e); }
}

function addToCart(sku) {
  state.cart[sku] = (state.cart[sku] || 0) + 1;
  renderCart();
  saveCart();
}

function removeFromCart(sku) {
  delete state.cart[sku];
  renderCart();
  saveCart();
}

function cartTotal() {
  return Object.entries(state.cart).reduce((sum,[sku,qty]) => {
    const p = state.products.find(x=>x.sku===sku);
    return sum + (p? p.price*qty : 0);
  }, 0);
}

function renderCart() {
  const wrap = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');
  if (!wrap || !totalEl) return;
  wrap.innerHTML = Object.entries(state.cart).map(([sku,qty]) => {
    const p = state.products.find(x=>x.sku===sku);
    if (!p) return '';
    return `<div><span>${p.name} × ${qty}</span><span>$${(p.price*qty).toLocaleString()} <a href="#" onclick="removeFromCart('${sku}')">✕</a></span></div>`;
  }).join('');
  totalEl.textContent = `$${cartTotal().toLocaleString()}`;
}

function saveCart() { localStorage.setItem('gies_cart', JSON.stringify(state.cart)); }
function loadCart() {
  try { state.cart = JSON.parse(localStorage.getItem('gies_cart')) || {}; } catch(e) { state.cart = {}; }
}

function initLangSelector() {
  const sel = document.getElementById('langSelect');
  if (!sel) return;
  sel.value = state.lang;
  sel.addEventListener('change', (e)=>loadI18n(e.target.value));
}

document.addEventListener('DOMContentLoaded', async () => {
  loadCart();
  await loadI18n('en');
  initLangSelector();
  await loadProducts();
  renderCart();
  document.getElementById('checkoutBtn')?.addEventListener('click', () => {
    const summary = Object.entries(state.cart).map(([sku,qty]) => {
      const p = state.products.find(x=>x.sku===sku); return p ? `${p.name} x ${qty}` : sku;
    }).join('\n');
    const body = encodeURIComponent(`Order Summary:\n${summary}\nTotal: ${cartTotal()}`);
    window.location.href = `mailto:mohammad1anvar1@gmail.com?subject=GIES%20Order&body=${body}`;
  });
});

let CONFIG = {};
async function loadConfig() {
  try {
    const res = await fetch('config.json');
    CONFIG = await res.json();
  } catch(e) { CONFIG = {}; }
}

function buildFilters() {
  const catSel = document.getElementById('filterCategory');
  if (!catSel) return;
  const cats = Array.from(new Set(state.products.map(p => p.category))).sort();
  cats.forEach(c => {
    const opt = document.createElement('option'); opt.value = c; opt.textContent = c; catSel.appendChild(opt);
  });
}

function applyProductFilters() {
  const minKw = parseFloat(document.getElementById('filterMinKw')?.value || ''); 
  const maxKw = parseFloat(document.getElementById('filterMaxKw')?.value || '');
  const cat = document.getElementById('filterCategory')?.value || '';
  const grid = document.getElementById('productGrid');
  const filtered = state.products.filter(p => {
    const okCat = !cat || p.category === cat;
    const okMin = isNaN(minKw) || (p.kw ?? 0) >= minKw;
    const okMax = isNaN(maxKw) || (p.kw ?? Infinity) <= maxKw;
    return okCat && okMin && okMax;
  });
  grid.innerHTML = filtered.map(p => `
      <div class="product-card" id="card-${p.sku}">
        <img src="${p.image || ''}" alt="${p.name}">
        <div class="pad">
          <h3><a href="en/product-${p.sku.toLowerCase()}.html" style="text-decoration:none;color:inherit">${p.name}</a></h3>
          <div class="price">$${p.price.toLocaleString()}</div>
          <p>${p.description || ''}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn primary" onclick="addToCart('${p.sku}')">${state.dict.home?.cta_shop || 'Add to Cart'}</button>
            ${p.paymentLink ? `<a class='btn ghost' target='_blank' href='${p.paymentLink}'>Buy Now</a>` : ''}
          </div>
        </div>
      </div>`).join('');
}

function updateShippingEstimator() {
  const shipSel = document.getElementById('shipCountry');
  const includeVAT = document.getElementById('includeVAT');
  if (!shipSel || !CONFIG.shipping) return;
  const country = shipSel.value;
  const rule = CONFIG.shipping.countries[country];
  let weight = Object.entries(state.cart).reduce((w,[sku,qty]) => {
    const p = state.products.find(x=>x.sku===sku); return w + (p?.weight_kg || 0)*qty;
  }, 0);
  const shipping = rule.base + rule.perKg * weight;
  const subtotal = cartTotal();
  const vat = includeVAT.checked ? (subtotal + shipping) * (rule.vat || 0) : 0;
  const total = subtotal + shipping + vat;
  const totalEl = document.getElementById('cartTotal');
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)} (Items: $${subtotal.toFixed(2)} · Ship: $${shipping.toFixed(2)} · VAT: $${vat.toFixed(2)})`;
}

async function postCRM(payload) {
  try {
    if (!CONFIG.crmWebhookUrl) return;
    await fetch(CONFIG.crmWebhookUrl, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
  } catch(e) { console.warn('CRM webhook failed', e); }
}

async function initPayPal() {
  if (!document.getElementById('paypal-button-container')) return;
  if (!CONFIG.paypalClientId) return;
  const s = document.createElement('script');
  s.src = `https://www.paypal.com/sdk/js?client-id=${CONFIG.paypalClientId}&currency=USD`;
  s.onload = () => {
    // eslint-disable-next-line
    paypal.Buttons({
      createOrder: (data, actions) => {
        const amount = cartTotal();
        return actions.order.create({ purchase_units: [{ amount: { value: amount.toFixed(2) } }] });
      },
      onApprove: (data, actions) => actions.order.capture().then(async (details) => {
        await postCRM({type:'paypal_checkout', order: details, cart: state.cart});
        alert('Payment completed. Thank you!'); state.cart={}; saveCart(); renderCart();
      })
    }).render('#paypal-button-container');
  };
  document.body.appendChild(s);
}

function initStripe() {
  const btn = document.getElementById('stripeBtn');
  if (!btn || !CONFIG.stripePublishableKey) return;
  btn.addEventListener('click', async () => {
    // Static-site friendly: open a Payment Link if defined at catalog level, else email checkout fallback
    // For advanced: set up a serverless function to create a Checkout Session.
    const sum = cartTotal();
    await postCRM({type:'stripe_intent', cart: state.cart, total: sum});
    alert('Stripe checkout requires a Payment Link or serverless function. Configure in config.json or your backend.');
  });
}

function attachFilterHandlers() {
  document.getElementById('applyFilters')?.addEventListener('click', applyProductFilters);
  document.getElementById('clearFilters')?.addEventListener('click', () => {
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterMinKw').value = '';
    document.getElementById('filterMaxKw').value = '';
    applyProductFilters();
  });
}

function handleQuoteForm() {
  const form = document.getElementById('quoteForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    // Let Netlify handle if present; also send CRM webhook
    const summary = Object.entries(state.cart).map(([sku,qty]) => {
      const p = state.products.find(x=>x.sku===sku); return p ? `${p.name} x ${qty}` : sku;
    });
    await postCRM({type:'quote_request', cart: state.cart, summary});
  });
}

const origRenderCart = renderCart;
renderCart = function() { origRenderCart(); updateShippingEstimator(); }

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await loadProducts(); // already called earlier, but safe
  buildFilters();
  attachFilterHandlers();
  applyProductFilters();
  initPayPal();
  initStripe();
  handleQuoteForm();
  document.getElementById('shipCountry')?.addEventListener('change', updateShippingEstimator);
  document.getElementById('includeVAT')?.addEventListener('change', updateShippingEstimator);
  updateShippingEstimator();
  // Deep link: #sku=XYZ to scroll and highlight
  const sku = new URL(location.href).hash.split('sku=')[1];
  if (sku) {
    const el = document.getElementById('card-' + sku);
    if (el) { el.scrollIntoView({behavior:'smooth'}); el.style.outline='3px solid var(--primary)'; }
  }
});
