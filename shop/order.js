// shop/order.js
import { checkCodeWord } from './gate.js';

const WORKER_BASE_URL = 'https://rustnuts-shop-worker.cdyson.workers.dev';

const cart = [];
let catalog = [];
const unlockedGated = new Set();

async function loadCatalog() {
  try {
    const res = await fetch(`${WORKER_BASE_URL}/catalog`);
    if (!res.ok) throw new Error(`Catalog request failed: ${res.status}`);
    catalog = await res.json();
    renderDesigns();
  } catch (err) {
    document.getElementById('design-grid').innerHTML =
      '<p>Could not load products right now. Please refresh the page or try again shortly.</p>';
    console.error('loadCatalog failed:', err);
  }
}

function renderDesigns() {
  const grid = document.getElementById('design-grid');
  grid.innerHTML = '';

  for (const design of catalog) {
    const card = document.createElement('div');
    card.className = 'product-card';

    const gateHtml = design.gated && !unlockedGated.has(design.id)
      ? `<div class="gate">
           <input type="text" placeholder="Enter club code word" class="gate-input">
           <button type="button" class="gate-submit">Unlock</button>
         </div>`
      : '';

    const orderHtml = !design.gated || unlockedGated.has(design.id)
      ? `<div class="order-controls">
           <select class="garment-select">
             ${Object.entries(design.garments).map(([key, g]) => `<option value="${key}">${g.label}</option>`).join('')}
           </select>
           <select class="size-select"></select>
           <input type="number" class="qty-input" min="1" value="1">
           <button type="button" class="add-btn">Add to order</button>
         </div>`
      : '';

    card.innerHTML = `
      <div class="product-info">
        <div class="name">${design.name}</div>
        <div class="price">Price TBA</div>
      </div>
      ${gateHtml}
      ${orderHtml}
    `;

    if (design.gated && !unlockedGated.has(design.id)) {
      card.querySelector('.gate-submit').addEventListener('click', () => {
        const val = card.querySelector('.gate-input').value;
        if (checkCodeWord(val)) {
          unlockedGated.add(design.id);
          renderDesigns();
        } else {
          card.querySelector('.gate-input').style.borderColor = 'var(--red-bright)';
        }
      });
    } else {
      const garmentSelect = card.querySelector('.garment-select');
      const sizeSelect = card.querySelector('.size-select');

      function refreshSizes() {
        const garment = design.garments[garmentSelect.value];
        sizeSelect.innerHTML = garment.sizes.map((s) => `<option value="${s}">${s}</option>`).join('');
      }
      garmentSelect.addEventListener('change', refreshSizes);
      refreshSizes();

      card.querySelector('.add-btn').addEventListener('click', () => {
        const garmentKey = garmentSelect.value;
        const size = sizeSelect.value;
        const qty = parseInt(card.querySelector('.qty-input').value, 10);
        if (!Number.isInteger(qty) || qty <= 0) return;
        cart.push({ designId: design.id, garmentKey, size, qty });
        renderCart();
      });
    }

    grid.appendChild(card);
  }
}

function renderCart() {
  const panel = document.getElementById('cart-panel');
  const list = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const form = document.getElementById('order-form');

  if (cart.length === 0) {
    panel.hidden = true;
    form.hidden = true;
    return;
  }

  panel.hidden = false;
  form.hidden = false;

  list.innerHTML = cart.map((item, i) => {
    const design = catalog.find((d) => d.id === item.designId);
    const garment = design.garments[item.garmentKey];
    return `<li>${design.name} / ${garment.label} / ${item.size} × ${item.qty}
      <button type="button" data-remove="${i}">Remove</button></li>`;
  }).join('');
  totalEl.textContent = 'Pricing to be confirmed — you\'ll be sent a total by email.';

  list.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      cart.splice(Number(btn.dataset.remove), 1);
      renderCart();
    });
  });
}

function clearShippingFields(form) {
  form.street.value = '';
  form.suburb.value = '';
  form.state.value = '';
  form.postcode.value = '';
  form.shippingMethod.value = 'standard';
}

function wireDeliveryToggle() {
  const form = document.getElementById('order-form');
  const shippingFields = document.getElementById('shipping-fields');
  form.querySelectorAll('input[name="delivery"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isShip = form.delivery.value === 'ship';
      shippingFields.hidden = !isShip;
      if (!isShip) clearShippingFields(form);
    });
  });
}

function wireSubmit() {
  const form = document.getElementById('order-form');
  const confirmation = document.getElementById('order-confirmation');
  const errorEl = document.getElementById('order-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    confirmation.hidden = true;
    errorEl.hidden = true;

    const buyer = {
      name: form.name.value,
      email: form.email.value,
      phone: form.phone.value,
      delivery: form.delivery.value,
      ...(form.delivery.value === 'ship' ? {
        street: form.street.value,
        suburb: form.suburb.value,
        state: form.state.value,
        postcode: form.postcode.value,
        shippingMethod: form.shippingMethod.value,
      } : {}),
    };

    try {
      const res = await fetch(`${WORKER_BASE_URL}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer, items: cart }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order failed.');

      confirmation.hidden = false;
      confirmation.textContent = `Thanks, ${buyer.name}! Order ${data.orderRef} submitted — check your email for payment details.`;
      cart.length = 0;
      renderCart();
      form.reset();
      document.getElementById('shipping-fields').hidden = true;
      clearShippingFields(form);
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = err.message;
    }
  });
}

document.getElementById('yr')?.replaceChildren(String(new Date().getFullYear()));
wireDeliveryToggle();
wireSubmit();
loadCatalog();
