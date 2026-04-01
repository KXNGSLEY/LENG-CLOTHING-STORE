// server.js
// Run with: node server.js
// Then open http://localhost:3000
const express = require('express');
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const multer = require("multer");
const session = require("express-session");
const admin = require("firebase-admin");
const { Datastore } = require("@google-cloud/datastore");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── FIREBASE & DATASTORE SETUP ──────────────────────────────────────────────
let serviceAccount;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  // ← Production on Render (recommended)
  try {
    serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  } catch (e) {
    console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON");
    throw e;
  }
} else {
  // ← Local development (Replit, your machine, etc.)
  serviceAccount = require("./prototype-v-1-firebase-adminsdk-fbsvc-115e00a28b.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Datastore client
const db = new Datastore({
  projectId: serviceAccount.project_id,
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key.replace(/\\n/g, '\n')
  }
});

console.log(`✅ Datastore initialized for project: ${serviceAccount.project_id}`);

// ─── IMGBB API KEY ───────────────────────────────────────────────────────────
const IMGBB_API_KEY = "5b10aa56b841e44be350b902f4f915d6";

// ─── HELPER TO FORMAT NAIRA ──────────────────────────────────────────────────
function formatNaira(price) {
  return `₦${Number(price).toLocaleString('en-US')}`;
}

// ─── SESSION & MULTER SETUP ──────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: "leng-secret",
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 600000 }
}));
const upload = multer({ storage: multer.memoryStorage() });

// ─── SHARED HTML PARTS ───────────────────────────────────────────────────────
const sharedHead = `
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Orbitron', sans-serif;
      background:#000;
      color:#e0ffe0;
      min-height:100vh;
      overflow-x:hidden;
      position:relative;
    }
    .cosmic-bg { position:fixed; inset:0; pointer-events:none; z-index:-1;
      background: radial-gradient(circle at 20% 30%, rgba(10,20,60,0.8) 0%, #000 40%),
                  radial-gradient(circle at 80% 70%, rgba(40,0,80,0.6) 0%, #000 50%);
      animation: cosmicShift 40s ease-in-out infinite alternate;
    }
    @keyframes cosmicShift { 0% { background-position: 0% 0%, 100% 100%; } 100% { background-position: 100% 100%, 0% 0%; } }
    .particles { position:fixed; inset:0; pointer-events:none; z-index:0; }
    .particle { position:absolute; background:#e0ffe0; border-radius:50%; box-shadow:0 0 12px rgba(224,255,224,0.6); opacity:0.4; animation:float linear infinite; }
    @keyframes float { 0% { transform:translateY(0) translateX(0); opacity:0.3; } 50% { opacity:0.7; } 100% { transform:translateY(-120vh) translateX(30vw); opacity:0; } }
    .shooting-star { position:fixed; width:2px; height:120px; background:linear-gradient(to bottom, rgba(0,255,80,0), rgba(0,255,80,0.9), rgba(0,255,80,0)); opacity:0.8; pointer-events:none; transform:rotate(45deg); filter:drop-shadow(0 0 12px rgba(0,255,80,0.6)); animation:shoot linear forwards; }
    @keyframes shoot { 0% { transform:translate(0,0) rotate(45deg); opacity:1; } 100% { transform:translate(-120vw,120vh) rotate(45deg); opacity:0; } }
    header {
      position:fixed; top:0; width:100%; padding:1rem 5%;
      display:flex; justify-content:space-between; align-items:center;
      background:rgba(0,0,0,0.85); backdrop-filter:blur(12px); z-index:1000;
      border-bottom:1px solid rgba(0,255,80,0.15);
    }
    .logo { font-size:2.2rem; font-weight:900; color:#00ff50; text-shadow:0 0 20px #00ff50; letter-spacing:4px; animation:glow 4s ease-in-out infinite alternate; }
    @keyframes glow { from { text-shadow:0 0 10px #00ff50; } to { text-shadow:0 0 40px #00ff50; } }
    nav a { color:#e0ffe0; text-decoration:none; margin-left:2.5rem; font-weight:500; transition:all 0.4s; }
    nav a:hover { color:#00ff50; text-shadow:0 0 15px #00ff50; transform:translateY(-2px); }
    .cart-icon {
      position: relative;
      font-size: 1.8rem;
      color: #00ff50;
      cursor: pointer;
      transition: all 0.3s;
    }
    .cart-icon:hover { transform: scale(1.15); text-shadow: 0 0 15px #00ff50; }
    .cart-count {
      position: absolute;
      top: -8px; right: -12px;
      background: #ff0044;
      color: white;
      font-size: 0.75rem;
      font-weight: bold;
      width: 20px; height: 20px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 10px rgba(255,0,68,0.7);
    }
    .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px,1fr)); gap:2.5rem; max-width:1400px; margin:0 auto; padding:0 5%; }
    .card {
      background:rgba(10,10,10,0.75); border:1px solid rgba(0,255,80,0.12);
      border-radius:16px; overflow:hidden; transition:all 0.5s cubic-bezier(0.23,1,0.32,1);
      backdrop-filter:blur(8px); opacity:0; transform:translateY(60px); position:relative;
    }
    .card.visible { opacity:1; transform:translateY(0); }
    .card:hover { transform:translateY(-16px) scale(1.04); box-shadow:0 30px 80px rgba(0,255,80,0.2); border-color:#00ff50; }
    .card img { width:100%; height:380px; object-fit:cover; transition:transform 0.8s; }
    .card:hover img { transform:scale(1.12); }
    .card-info { padding:1.8rem; text-align:center; }
    .card h3 { color:#00ff50; font-size:1.6rem; margin-bottom:0.8rem; }
    .price { font-size:1.5rem; font-weight:700; color:#d0ffd0; }
    .add-to-cart-small {
      position: absolute; bottom: 15px; left: 50%; transform: translateX(-50%);
      background: #00ff50; color: #000; border: none; padding: 0.6rem 1.2rem;
      border-radius: 50px; cursor: pointer; font-weight: bold; font-size: 0.95rem;
      opacity: 0; transition: all 0.4s; box-shadow: 0 0 15px rgba(0,255,80,0.5);
    }
    .card:hover .add-to-cart-small { opacity: 1; }
    .add-to-cart-small:hover { transform: translateX(-50%) scale(1.1); box-shadow: 0 0 30px rgba(0,255,80,0.8); }
    footer { padding:4rem 5%; text-align:center; border-top:1px solid rgba(0,255,80,0.12); color:#888; font-size:0.95rem; }
    .card-link { text-decoration: none; color: inherit; display: block; }
    @media (max-width:768px) { header { flex-direction:column; gap:1rem; } nav a { margin:0 1rem; } }
  </style>
`;

const sharedHeader = `
  <header>
    <div class="logo">LENG</div>
    <nav>
      <a href="/">Home</a>
      <a href="/store">Shop</a>
      <a href="#">Journal</a>
      <a href="#">Contact</a>
      <a href="/admin">Admin</a>
    </nav>
    <div class="cart-icon" id="cartIcon">🛒
      <span class="cart-count" id="cartCount">0</span>
    </div>
  </header>
  <div class="cosmic-bg"></div>
  <div class="particles" id="particles"></div>
`;

const sharedScripts = `
  <script>
    // ─── PARTICLES & SHOOTING STARS ───────────────────────────────────────────
    function createParticle() {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 3 + 1;
      p.style.width = p.style.height = size + 'px';
      p.style.top = Math.random() * 120 + 'vh';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.animationDuration = Math.random() * 25 + 20 + 's';
      p.style.animationDelay = Math.random() * 10 + 's';
      document.getElementById('particles').appendChild(p);
      setTimeout(() => p.remove(), 40000);
    }
    setInterval(createParticle, 800);
    for(let i = 0; i < 40; i++) createParticle();

    function createShootingStar() {
      const star = document.createElement('div');
      star.className = 'shooting-star';
      star.style.top = Math.random() * 40 + 'vh';
      star.style.left = Math.random() * 120 + 20 + 'vw';
      const duration = Math.random() * 1.5 + 1.2;
      star.style.animationDuration = duration + 's';
      document.body.appendChild(star);
      setTimeout(() => star.remove(), duration * 1000);
    }
    setInterval(() => { if (Math.random() > 0.4) createShootingStar(); }, Math.random() * 6000 + 6000);

    // ─── CART SYSTEM (localStorage) ──────────────────────────────────────────
    function getCart() {
      return JSON.parse(localStorage.getItem('lengCart') || '[]');
    }

    function saveCart(cart) {
      localStorage.setItem('lengCart', JSON.stringify(cart));
    }

    function updateCartDisplay() {
      const cart = getCart();
      const countEl = document.getElementById('cartCount');
      if (countEl) {
        countEl.textContent = cart.length;
        countEl.style.display = cart.length > 0 ? 'flex' : 'none';
      }
      const icon = document.getElementById('cartIcon');
      if (icon) {
        icon.classList.add('pulse-once');
        setTimeout(() => icon.classList.remove('pulse-once'), 800);
      }
    }

    function addToCart(itemId, description, price, image) {
      const cart = getCart();
      const existing = cart.find(i => i.id === itemId);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
      } else {
        cart.push({ id: itemId, description, price, image, quantity: 1 });
      }
      saveCart(cart);
      updateCartDisplay();
    }

    window.addEventListener('load', updateCartDisplay);

    // ─── MAKE CART ICON CLICKABLE ON EVERY PAGE ──────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
      const cartIcon = document.getElementById('cartIcon');
      if (cartIcon) {
        cartIcon.style.cursor = 'pointer';
        cartIcon.addEventListener('click', () => {
          window.location.href = '/cart';
        });
      }
    });

    // Card reveal on scroll
    const cards = document.querySelectorAll('.card');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.2 });
    cards.forEach(card => observer.observe(card));
  </script>
  <style>
    @keyframes pulse-once {
      0% { transform: scale(1); }
      50% { transform: scale(1.4); }
      100% { transform: scale(1); }
    }
    .pulse-once { animation: pulse-once 0.6s ease-in-out; }
  </style>
`;

// ─── HOME PAGE ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <title>LENG — Future Fashion</title>
  ${sharedHead}
  <style>
    #hero { height: 60vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 0 5%; position: relative; z-index: 2; }
    #hero h1 { font-size: clamp(4rem, 12vw, 10rem); font-weight: 900; color: #00ff50; text-shadow: 0 0 40px rgba(0,255,80,0.6); margin-bottom: 1.5rem; animation: slideIn 1.4s cubic-bezier(0.16, 1, 0.3, 1); }
    #hero p { font-size: 1.6rem; max-width: 700px; margin-bottom: 3rem; opacity: 0.9; animation: fadeIn 2s 0.6s both; }
    .cta { 
      padding: 1rem 3rem; 
      font-size: 1.4rem; 
      font-weight: 700; 
      background: #00ff50; 
      color: #000; 
      border: none; 
      border-radius: 50px; 
      cursor: pointer; 
      box-shadow: 0 0 40px rgba(0,255,80,0.5); 
      transition: all 0.4s; 
      animation: pulse 2.5s infinite; 
    }
    .cta:hover { 
      transform: translateY(-6px) scale(1.08); 
      box-shadow: 0 0 80px rgba(0,255,80,0.7); 
    }
    @keyframes slideIn { from { opacity: 0; transform: translateY(120px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { to { opacity: 1; } }
    @keyframes pulse { 0%,100% { box-shadow: 0 0 30px rgba(0,255,80,0.4); } 50% { box-shadow: 0 0 70px rgba(0,255,80,0.8); } }
    #products { padding: 12rem 5% 8rem; position: relative; z-index: 2; }
    #products h2 { text-align: center; font-size: 4.5rem; color: #00ff50; margin-bottom: 6rem; text-shadow: 0 0 30px #00ff50; }
  </style>
</head>
<body>
  ${sharedHeader}
  <section id="hero">
    <h1>LENG</h1>
    <p>Where tomorrow’s aesthetic meets today’s edge.</p>

    <!-- FIXED BUTTON - Now leads to the store -->
    <a href="/store">
      <button class="cta">Enter Collection</button>
    </a>
  </section>

  <section id="products">
    <h2>Latest Drop</h2>
    <div class="grid">
      <div class="card"><img src="https://images.unsplash.com/photo-1643308003721-aa0440f10c9b?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Cyber jacket"><div class="card-info"><h3>NEON TRACE JACKET</h3><div class="price"></div></div></div>
      <div class="card"><img src="https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80" alt="Tech pants"><div class="card-info"><h3>VOID CARGO</h3><div class="price"></div></div></div>
      <div class="card"><img src="https://images.unsplash.com/photo-1762575910569-46971cd69df3?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Sneakers"><div class="card-info"><h3>NIKE TECH</h3><div class="price"></div></div></div>
      <div class="card"><img src="https://images.unsplash.com/photo-1773236237763-316007e53dce?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Mask"><div class="card-info"><h3>CASUAL WEAR</h3><div class="price"></div></div></div>
    </div>
  </section>
  <footer>© 2026 LENG — All rights reserved.<br>.</footer>
  ${sharedScripts}
</body>
</html>
  `);
});

// ─── STORE PAGE (with Sold Out Overlay) ──────────────────────────────────────
app.get("/store", async (req, res) => {
  const query = db.createQuery("storeItems").order("createdAt", { descending: true });
  const [items] = await db.runQuery(query);

  // Featured items
  let featuredItems = [];
  const availableItems = items.filter(item => item.soldOut !== true);
  if (availableItems.length >= 3) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const seed = today.getTime();
    const shuffled = [...availableItems];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor((seed + i) % (i + 1) * (i + 1) / 1000) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    featuredItems = shuffled.slice(0, 3);
  }

  let featuredHtml = "";
  if (featuredItems.length > 0) {
    featuredHtml = `
      <section id="featured" style="padding: 5rem 5% 3rem; position: relative; z-index: 2;">
        <h2 style="text-align:center; font-size:3.2rem; color:#00ff50; margin-bottom:2.5rem; text-shadow:0 0 25px #00ff50;">Featured Drop</h2>
        <div class="featured-carousel">
          <div class="carousel-track">
            ${featuredItems.map(item => {
              const entityKey = item[Datastore.KEY];
              const itemId = entityKey.id || entityKey.name;
              const firstImage = item.imageUrls?.[0] || item.imageUrl || 'https://via.placeholder.com/600?text=Featured';
              return `
                <div class="carousel-slide">
                  <div class="featured-card" style="border:1px solid rgba(0,255,80,0.25); background:rgba(10,10,10,0.75); border-radius:20px; overflow:hidden; backdrop-filter:blur(10px); box-shadow:0 10px 40px rgba(0,0,0,0.6); position:relative;">
                    <a href="/product/${itemId}" style="text-decoration:none; color:inherit; display:block;">
                      <div style="height:560px; overflow:hidden;">
                        <img src="${firstImage}" alt="${item.description}" style="width:100%; height:100%; object-fit:cover; transition:transform 0.6s ease;">
                      </div>
                      <div style="padding:1.8rem; text-align:center;">
                        <h3 style="color:#00ff50; font-size:1.9rem; margin-bottom:0.7rem;">${item.description}</h3>
                        <div style="font-size:1.8rem; font-weight:900; color:#d0ffd0;">${formatNaira(item.price)}</div>
                      </div>
                    </a>
                    <button class="add-to-cart-small"
                            onclick="addToCart('${itemId}', '${item.description.replace(/'/g, "\\'")}', ${item.price}, '${firstImage}')">
                      ADD TO CART
                    </button>
                    <div style="position:absolute; top:15px; left:15px; background:rgba(0,255,80,0.3); color:#00ff50; padding:0.5rem 1.1rem; border-radius:50px; font-size:1rem; font-weight:600; backdrop-filter:blur(6px);">FEATURED</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <button class="carousel-prev">←</button>
          <button class="carousel-next">→</button>
          <div class="carousel-dots">
            ${featuredItems.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('')}
          </div>
        </div>
      </section>
    `;
  }

  // Regular items
  let itemsHtml = "";
  items.forEach(item => {
    const entityKey = item[Datastore.KEY];
    const itemId = entityKey.id || entityKey.name;
    const firstImage = item.imageUrls?.[0] || item.imageUrl || 'https://via.placeholder.com/400?text=No+Image';
    const isSoldOut = item.soldOut === true;

    itemsHtml += `
      <div class="card ${isSoldOut ? 'sold-out-card' : ''}" style="position:relative;">
        <a href="/product/${itemId}" class="card-link">
          <img src="${firstImage}" alt="${item.description}">
          ${isSoldOut ? `<div class="sold-out-overlay"><div class="sold-out-text">SOLD OUT</div></div>` : ''}
        </a>
        <div class="card-info">
          <h3>${item.description}</h3>
          <div class="price">${formatNaira(item.price)}</div>
        </div>
        ${!isSoldOut ? `
          <button class="add-to-cart-small"
                  onclick="addToCart('${itemId}', '${item.description.replace(/'/g, "\\'")}', ${item.price}, '${firstImage}')">
            ADD TO CART
          </button>
        ` : ''}
      </div>
    `;
  });

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <title>LENG Store</title>
  ${sharedHead}
  <style>
    #store-hero {
      height: 18vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 0 5%;
      position: relative;
      z-index: 2;
    }
    #store-hero h1 {
      font-size: clamp(4rem, 10vw, 8rem);
      color: #00ff50;
      text-shadow: 0 0 40px rgba(0,255,80,0.6);
    }
    #products { padding: 4rem 5% 8rem; }

    /* Sold Out Styles */
    .sold-out-card {
      opacity: 0.5;
      border-color: #ff0044 !important;
    }
    .sold-out-card:hover {
      transform: translateY(-8px) scale(1.02) !important;
    }
    .sold-out-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 255, 80, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
      backdrop-filter: blur(4px);
    }
    .sold-out-text {
      color: white;
      font-size: 2.8rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 6px;
      text-shadow: 0 0 30px rgba(0,0,0,0.9);
      border: 4px solid white;
      padding: 12px 40px;
      border-radius: 8px;
      transform: rotate(-12deg);
      animation: pulse-sold 2s infinite;
    }
    @keyframes pulse-sold {
      0%, 100% { transform: rotate(-12deg) scale(1); }
      50% { transform: rotate(-12deg) scale(1.08); }
    }

    /* Carousel Styles */
    .featured-carousel {
      position: relative;
      max-width: 1400px;
      margin: 0 auto;
      overflow: hidden;
    }
    .carousel-track {
      display: flex;
      transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
    }
    .carousel-slide {
      flex: 0 0 100%;
      min-width: 100%;
      padding: 0 1.5rem;
      box-sizing: border-box;
    }
    .carousel-prev, .carousel-next {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(0,255,80,0.15);
      color: #00ff50;
      border: 1px solid rgba(0,255,80,0.4);
      font-size: 2.2rem;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      cursor: pointer;
      z-index: 10;
      backdrop-filter: blur(6px);
      transition: all 0.3s;
    }
    .carousel-prev:hover, .carousel-next:hover {
      background: #00ff50;
      color: #000;
      box-shadow: 0 0 30px rgba(0,255,80,0.6);
      transform: translateY(-50%) scale(1.12);
    }
    .carousel-prev { left: 20px; }
    .carousel-next { right: 20px; }
    .carousel-dots {
      text-align: center;
      padding: 1.8rem 0 0.5rem;
    }
    .carousel-dot {
      height: 13px;
      width: 13px;
      margin: 0 9px;
      background: rgba(0,255,80,0.3);
      border-radius: 50%;
      display: inline-block;
      cursor: pointer;
      transition: all 0.3s;
    }
    .carousel-dot.active {
      background: #00ff50;
      transform: scale(1.4);
    }
  </style>
</head>
<body>
  ${sharedHeader}
  <section id="store-hero">
    <h1>STORE</h1>
    <p>All drops. All edge.</p>
  </section>
  ${featuredHtml}
  <section id="products">
    <div class="grid">
      ${itemsHtml || '<p style="grid-column: 1 / -1; text-align: center; font-size: 1.5rem; opacity: 0.7;">No items yet — check back soon!</p>'}
    </div>
  </section>
  <footer>© 2026 LENG — All rights reserved.<br>.</footer>
  ${sharedScripts}
  <!-- Featured Carousel Script -->
  <script>
    const track = document.querySelector('.carousel-track');
    if (track) {
      const slides = document.querySelectorAll('.carousel-slide');
      const prevBtn = document.querySelector('.carousel-prev');
      const nextBtn = document.querySelector('.carousel-next');
      const dots = document.querySelectorAll('.carousel-dot');
      let currentIndex = 0;
      function setPositionByIndex() {
        const translate = currentIndex * -100;
        track.style.transform = \`translateX(\${translate}%)\`;
        dots.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
      }
      nextBtn?.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % slides.length;
        setPositionByIndex();
      });
      prevBtn?.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + slides.length) % slides.length;
        setPositionByIndex();
      });
      let autoSlide = setInterval(() => {
        currentIndex = (currentIndex + 1) % slides.length;
        setPositionByIndex();
      }, 4800);
      dots.forEach((dot, i) => {
        dot.addEventListener('click', () => {
          currentIndex = i;
          setPositionByIndex();
          clearInterval(autoSlide);
          autoSlide = setInterval(() => {
            currentIndex = (currentIndex + 1) % slides.length;
            setPositionByIndex();
          }, 4800);
        });
      });
      setPositionByIndex();
    }
  </script>
</body>
</html>
  `);
});

// ─── PRODUCT DETAIL PAGE ─────────────────────────────────────────────────────
app.get("/product/:id", async (req, res) => {
  const id = req.params.id;
  let key;
  const numericId = Number(id);
  if (!isNaN(numericId)) {
    key = db.key(["storeItems", numericId]);
  } else {
    key = db.key(["storeItems", id]);
  }
  const [item] = await db.get(key);
  if (!item) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head><title>Not Found — LENG</title>${sharedHead}</head>
      <body>
        ${sharedHeader}
        <div style="padding:12rem 5%; text-align:center;">
          <h1 style="color:#00ff50; font-size:3.5rem;">Product Not Found</h1>
          <p style="font-size:1.4rem; margin:2rem 0; opacity:0.8;">
            This item may have been removed or the link is no longer valid.
          </p>
          <a href="/store" style="color:#00ff50; font-size:1.3rem; text-decoration:underline;">Back to Store</a>
        </div>
      </body>
      </html>
    `);
  }

  const ratings = item.ratings || [];
  const avgRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + Number(r.rating), 0) / ratings.length).toFixed(1)
    : "—";
  const ratingCount = ratings.length;

  const images = item.imageUrls || (item.imageUrl ? [item.imageUrl] : []);
  const firstImage = images[0] || 'https://via.placeholder.com/800x600/111/00ff50?text=No+Image';

  let slidesHtml = "";
  let dotsHtml = "";
  images.forEach((url, i) => {
    slidesHtml += `
      <div class="slide ${i === 0 ? 'active' : ''}" data-index="${i}">
        <img src="${url}" alt="${item.description} - ${i+1}">
      </div>`;
    dotsHtml += `
      <span class="dot ${i === 0 ? 'active' : ''}" onclick="currentSlide(${i})"></span>`;
  });

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <title>${item.description} — LENG</title>
  ${sharedHead}
  <style>
    .product-container {
      max-width: 1200px;
      margin: 10rem auto 6rem;
      padding: 0 5%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
    }
    .slideshow {
      position: relative;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(0,255,80,0.2);
      box-shadow: 0 0 40px rgba(0,255,80,0.15);
      background: #0a0a0a;
    }
    .slider-container {
      position: relative;
      height: 520px;           /* main image height */
      background: #111;
    }
    .slide {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      transition: opacity 0.6s ease;
      display: none;
    }
    .slide.active {
      opacity: 1;
      display: block;
    }
    .slide img {
      width: 100%;
      height: 100%;
      object-fit: cover;        /* ← This removes the black bars */
      object-position: center;
    }

    .slider-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(0,0,0,0.7);
      color: white;
      border: none;
      width: 50px;
      height: 50px;
      font-size: 2rem;
      cursor: pointer;
      border-radius: 50%;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
    }
    .slider-btn:hover {
      background: #00ff50;
      color: #000;
      transform: translateY(-50%) scale(1.1);
    }
    .slider-btn.prev { left: 15px; }
    .slider-btn.next { right: 15px; }

    .dots {
      text-align: center;
      padding: 1.2rem 0;
    }
    .dot {
      height: 13px; 
      width: 13px; 
      margin: 0 7px;
      background: rgba(0,255,80,0.3);
      border-radius: 50%;
      display: inline-block;
      cursor: pointer;
      transition: all 0.3s;
    }
    .dot.active { 
      background: #00ff50; 
      transform: scale(1.4);
    }

    .product-info h1 { 
      color: #00ff50; 
      font-size: 3.2rem; 
      margin-bottom: 1rem; 
    }
    .price-big { 
      font-size: 3.5rem; 
      font-weight: 900; 
      color: #d0ffd0; 
      margin: 1.5rem 0; 
    }
    .add-to-cart {
      display: inline-block;
      padding: 1.2rem 3rem;
      background: #00ff50;
      color: #000;
      font-size: 1.4rem;
      font-weight: 900;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      margin: 2rem 0;
      box-shadow: 0 0 30px rgba(0,255,80,0.5);
      transition: all 0.4s;
    }
    .add-to-cart:hover {
      transform: scale(1.08) translateY(-4px);
      box-shadow: 0 0 60px rgba(0,255,80,0.8);
    }
    .rating-panel, .comments-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: rgba(20,20,20,0.6);
      border-radius: 12px;
      border: 1px solid rgba(0,255,80,0.2);
    }
    .rating-panel h3, .comments-section h2 { 
      color:#00ff50; 
      margin-bottom:1rem; 
    }
    .stars-input {
      font-size: 2.2rem;
      color: #444;
      cursor: pointer;
      user-select: none;
    }
    .stars-input .star { transition: color 0.2s; }
    .stars-input .star:hover, .stars-input .star.selected { color: #00ff50; }

    .comment {
      background: rgba(20,20,20,0.6);
      padding: 1.5rem;
      border-radius: 12px;
      margin-bottom: 1.5rem;
      border: 1px solid rgba(0,255,80,0.15);
    }
    .comment-header { 
      display: flex; 
      justify-content: space-between; 
      margin-bottom: 0.8rem; 
      color: #00ff50; 
      font-size: 1.1rem; 
    }

    textarea {
      width: 100%;
      min-height: 120px;
      padding: 1rem;
      background: #111;
      color: #e0ffe0;
      border: 1px solid rgba(0,255,80,0.3);
      border-radius: 10px;
      resize: vertical;
    }
    button[type="submit"] {
      margin-top: 1rem;
      padding: 1rem 2.5rem;
      background: #00ff50;
      color: #000;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      font-weight: bold;
      font-size: 1.1rem;
    }

    @media (max-width: 900px) { 
      .product-container { grid-template-columns: 1fr; }
      .slider-container { height: 420px; }
    }
  </style>
</head>
<body>
  ${sharedHeader}
  <div class="product-container">

    <!-- IMAGE SLIDER -->
    <div>
      <div class="slideshow">
        <div class="slider-container" id="sliderContainer">
          ${slidesHtml}
        </div>

        ${images.length > 1 ? `
        <button class="slider-btn prev" onclick="changeSlide(-1)">‹</button>
        <button class="slider-btn next" onclick="changeSlide(1)">›</button>` : ''}
      </div>

      <div class="dots">
        ${dotsHtml}
      </div>
    </div>

    <!-- PRODUCT INFO -->
    <div class="product-info">
      <h1>${item.description}</h1>
      <div class="price-big">${formatNaira(item.price)}</div>

      <button class="add-to-cart" 
              onclick="addToCart('${id}', '${item.description.replace(/'/g, "\\'")}', ${item.price}, '${firstImage}')">
        ADD TO CART
      </button>

      <div class="rating-panel">
        <h3>Rate this item</h3>
        <form method="POST" action="/product/${id}/rate">
          <div class="stars-input" id="starsInput">
            <span class="star" data-value="1">★</span>
            <span class="star" data-value="2">★</span>
            <span class="star" data-value="3">★</span>
            <span class="star" data-value="4">★</span>
            <span class="star" data-value="5">★</span>
          </div>
          <input type="hidden" name="rating" id="ratingValue" value="0" required>
          <button type="submit" style="margin-top:1rem;">Submit Rating</button>
        </form>
      </div>

      <div class="comments-section">
        <h2 style="color:#00ff50; margin-bottom:1.5rem;">Comments</h2>
        ${item.comments?.map(c => `
          <div class="comment">
            <div class="comment-header">
              <strong>${c.username || "ANON E. MUSS"}</strong>
              <span>${new Date(c.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
            <p>${c.text}</p>
          </div>
        `).join('') || '<p style="opacity:0.7;">No comments yet. Be the first to share your thoughts!</p>'}

        <form class="comment-form" method="POST" action="/product/${id}/comment">
          <textarea name="comment" placeholder="Share your thoughts..." required></textarea>
          <button type="submit">Post Comment</button>
        </form>
      </div>
    </div>
  </div>

  <footer>© 2026 LENG — All rights reserved.<br>.</footer>
  ${sharedScripts}

  <script>
    let currentIndex = 0;
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');

    function showSlide(index) {
      slides.forEach(slide => slide.classList.remove('active'));
      dots.forEach(dot => dot.classList.remove('active'));

      if (index >= slides.length) currentIndex = 0;
      if (index < 0) currentIndex = slides.length - 1;

      slides[currentIndex].classList.add('active');
      dots[currentIndex].classList.add('active');
    }

    function changeSlide(n) {
      currentIndex += n;
      showSlide(currentIndex);
    }

    function currentSlide(index) {
      currentIndex = index;
      showSlide(currentIndex);
    }

    if (slides.length > 1) {
      setInterval(() => changeSlide(1), 5000);
    }

    // Keyboard support
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') changeSlide(-1);
      if (e.key === 'ArrowRight') changeSlide(1);
    });

    // Star rating
    const stars = document.querySelectorAll('#starsInput .star');
    const ratingInput = document.getElementById('ratingValue');
    stars.forEach(star => {
      star.addEventListener('click', () => {
        const value = star.dataset.value;
        ratingInput.value = value;
        stars.forEach(s => s.classList.toggle('selected', s.dataset.value <= value));
      });
    });
  </script>
</body>
</html>
  `);
});

// ─── SUBMIT RATING ───────────────────────────────────────────────────────────
app.post("/product/:id/rate", async (req, res) => {
  const id = req.params.id;
  let key;
  const numericId = Number(id);
  if (!isNaN(numericId)) key = db.key(["storeItems", numericId]);
  else key = db.key(["storeItems", id]);
  const [item] = await db.get(key);
  if (!item) return res.status(404).send("Product not found");
  const ratingValue = Number(req.body.rating);
  if (ratingValue < 1 || ratingValue > 5) return res.redirect(`/product/${id}`);
  const newRating = {
    rating: ratingValue,
    createdAt: new Date().toISOString()
  };
  const updatedRatings = [...(item.ratings || []), newRating];
  await db.update({ key, data: { ...item, ratings: updatedRatings } });
  res.redirect(`/product/${id}`);
});

// ─── POST COMMENT ────────────────────────────────────────────────────────────
app.post("/product/:id/comment", async (req, res) => {
  const id = req.params.id;
  let key;
  const numericId = Number(id);
  if (!isNaN(numericId)) key = db.key(["storeItems", numericId]);
  else key = db.key(["storeItems", id]);
  const [item] = await db.get(key);
  if (!item) return res.status(404).send("Product not found");
  const commentText = (req.body.comment || "").trim();
  if (!commentText) return res.redirect(`/product/${id}`);
  const username = req.session.user?.username || "ANON E. MUSS";
  const newComment = {
    username,
    text: commentText,
    createdAt: new Date().toISOString()
  };
  const updatedComments = [...(item.comments || []), newComment];
  await db.update({ key, data: { ...item, comments: updatedComments } });
  res.redirect(`/product/${id}`);
});

// ─── ADMIN LOGIN PAGE ────────────────────────────────────────────────────────
app.get("/admin", (req, res) => {
  if (req.session.authenticated) {
    return res.redirect("/admin-panel");
  }
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Admin Login</title>
  ${sharedHead}
  <style>
    main { height: 100vh; display: flex; justify-content: center; align-items: center; padding: 0 5%; }
    .box {
      background: rgba(10,10,10,0.75);
      border: 1px solid rgba(0,255,80,0.3);
      border-radius: 16px;
      padding: 3rem;
      max-width: 480px;
      width: 100%;
      backdrop-filter: blur(12px);
      box-shadow: 0 0 40px rgba(0,255,80,0.15);
    }
    h2 { color: #00ff50; text-shadow: 0 0 20px #00ff50; margin-bottom: 2rem; text-align: center; }
    input {
      width: 100%; padding: 1rem; margin: 0.8rem 0;
      border-radius: 10px; border: 1px solid rgba(0,255,80,0.3);
      background: #111; color: #e0ffe0; font-family: inherit;
    }
    button {
      width: 100%; padding: 1.2rem; margin-top: 1.5rem;
      background: #00ff50; color: #000; font-weight: 900;
      border: none; border-radius: 50px; cursor: pointer;
      font-size: 1.2rem; transition: all 0.3s;
    }
    button:hover { transform: translateY(-3px); box-shadow: 0 0 30px rgba(0,255,80,0.6); }
  </style>
</head>
<body>
  ${sharedHeader}
  <main>
    <div class="box">
      <h2>ADMIN ACCESS</h2>
      <form method="POST" action="/admin/login">
        <input name="passcode" type="password" placeholder="Enter Passcode" required autofocus />
        <button type="submit">Enter</button>
      </form>
    </div>
  </main>
  ${sharedScripts}
</body>
</html>
  `);
});

// ─── ADMIN LOGIN HANDLER ─────────────────────────────────────────────────────
app.post("/admin/login", (req, res) => {
  const passcode = req.body.passcode;
  if (passcode === "GLOCK9") {
    req.session.authenticated = true;
    return res.redirect("/admin-panel");
  }
  res.redirect("/admin");
});

// ─── CART PAGE ───────────────────────────────────────────────────────────────
app.get("/cart", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Your Cart — LENG</title>
  ${sharedHead}
  <style>
    #cart-container {
      max-width: 1100px;
      margin: 10rem auto 6rem;
      padding: 0 5%;
      position: relative;
      z-index: 2;
    }
    #cart-title {
      text-align: center;
      font-size: 3.5rem;
      color: #00ff50;
      margin-bottom: 3rem;
      text-shadow: 0 0 30px #00ff50;
    }
    .cart-item {
      display: flex;
      align-items: center;
      background: rgba(20,20,20,0.7);
      border: 1px solid rgba(0,255,80,0.2);
      border-radius: 16px;
      padding: 1.2rem;
      margin-bottom: 1.5rem;
      backdrop-filter: blur(8px);
      transition: all 0.3s;
    }
    .cart-item:hover {
      transform: translateY(-4px);
      box-shadow: 0 15px 40px rgba(0,255,80,0.15);
    }
    .cart-item img {
      width: 120px;
      height: 120px;
      object-fit: cover;
      border-radius: 12px;
      margin-right: 1.5rem;
    }
    .cart-item-info {
      flex: 1;
    }
    .cart-item-info h4 {
      color: #00ff50;
      margin: 0 0 0.5rem;
      font-size: 1.4rem;
    }
    .cart-item-price {
      font-size: 1.3rem;
      font-weight: bold;
      color: #d0ffd0;
    }
    .cart-quantity {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 0.8rem 0;
    }
    .qty-btn {
      background: rgba(0,255,80,0.2);
      color: #00ff50;
      border: 1px solid #00ff50;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 1.4rem;
      cursor: pointer;
      transition: all 0.3s;
    }
    .qty-btn:hover {
      background: #00ff50;
      color: #000;
      transform: scale(1.1);
    }
    .remove-btn {
      background: rgba(255,0,68,0.2);
      color: #ff0044;
      border: none;
      padding: 0.6rem 1.2rem;
      border-radius: 50px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s;
    }
    .remove-btn:hover {
      background: #ff0044;
      color: white;
    }
    .cart-summary {
      background: rgba(10,10,10,0.8);
      border: 1px solid rgba(0,255,80,0.3);
      border-radius: 16px;
      padding: 2rem;
      margin-top: 3rem;
      text-align: right;
    }
    .cart-total {
      font-size: 2.2rem;
      color: #00ff50;
      margin: 1rem 0;
    }
    .checkout-btn {
      display: inline-block;
      padding: 1.2rem 3.5rem;
      background: #00ff50;
      color: #000;
      font-size: 1.5rem;
      font-weight: 900;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      box-shadow: 0 0 40px rgba(0,255,80,0.5);
      transition: all 0.4s;
      animation: pulse 2.5s infinite;
    }
    .checkout-btn:hover {
      transform: scale(1.08) translateY(-4px);
      box-shadow: 0 0 70px rgba(0,255,80,0.8);
    }
    .empty-cart {
      text-align: center;
      font-size: 1.8rem;
      opacity: 0.8;
      padding: 8rem 0;
    }
  </style>
</head>
<body>
  ${sharedHeader}
  <div id="cart-container">
    <h1 id="cart-title">YOUR CART</h1>
    <div id="cart-items"></div>
    <div class="cart-summary" id="cartSummary" style="display:none;">
      <div class="cart-total">Total: <span id="cartTotal">₦0</span></div>
      <button class="checkout-btn" id="checkoutBtn">CHECKOUT VIA WHATSAPP</button>
    </div>
    <p class="empty-cart" id="emptyMessage" style="display:none;">
      Your cart is empty.<br><br>
      <a href="/store" style="color:#00ff50; text-decoration:underline; font-size:1.3rem;">Continue Shopping →</a>
    </p>
  </div>
  <footer>© 2026 LENG — All rights reserved.<br>.</footer>
  ${sharedScripts}
  <script>
    const WHATSAPP_NUMBER = "+2347010523880";

    function renderCart() {
      const cart = getCart();
      const container = document.getElementById('cart-items');
      const summary = document.getElementById('cartSummary');
      const emptyMsg = document.getElementById('emptyMessage');
      const totalEl = document.getElementById('cartTotal');

      container.innerHTML = '';

      if (cart.length === 0) {
        emptyMsg.style.display = 'block';
        summary.style.display = 'none';
        return;
      }

      emptyMsg.style.display = 'none';
      summary.style.display = 'block';

      let total = 0;
      let orderItems = [];

      cart.forEach((item, index) => {
        const qty = item.quantity || 1;
        const itemTotal = item.price * qty;
        total += itemTotal;

        orderItems.push('• ' + qty + 'x ' + item.description + ' — ₦' + Number(item.price).toLocaleString('en-US') + ' each (Subtotal: ₦' + itemTotal.toLocaleString('en-US') + ')');

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = \`
          <img src="\${item.image}" alt="\${item.description}">
          <div class="cart-item-info">
            <h4>\${item.description}</h4>
            <div class="cart-item-price">₦\${Number(item.price).toLocaleString('en-US')}</div>
            <div class="cart-quantity">
              <button class="qty-btn" onclick="changeQuantity(\${index}, -1)">−</button>
              <span>\${qty}</span>
              <button class="qty-btn" onclick="changeQuantity(\${index}, 1)">+</button>
            </div>
          </div>
          <div style="text-align:right; min-width:140px;">
            <div style="font-size:1.4rem; font-weight:bold; color:#d0ffd0; margin-bottom:1rem;">
              ₦\${itemTotal.toLocaleString('en-US')}
            </div>
            <button class="remove-btn" onclick="removeFromCart(\${index})">Remove</button>
          </div>
        \`;
        container.appendChild(div);
      });

      totalEl.textContent = '₦' + total.toLocaleString('en-US');

      const messageText = 
        "Hello LENG Team,\\n\\n" +
        "I would like to place the following order:\\n\\n" +
        orderItems.join("\\n") + "\\n\\n" +
        "Total Amount: ₦" + total.toLocaleString('en-US') + "\\n\\n" +
        "Please confirm availability and let me know the next steps for payment and delivery.\\n\\n" +
        "Thank you!\\n" +
        "— Customer";

      const encodedMessage = encodeURIComponent(messageText);

      document.getElementById('checkoutBtn').onclick = () => {
        window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodedMessage, '_blank');
      };
    }

    function changeQuantity(index, delta) {
      let cart = getCart();
      if (!cart[index]) return;
      cart[index].quantity = Math.max(1, (cart[index].quantity || 1) + delta);
      saveCart(cart);
      renderCart();
      updateCartDisplay();
    }

    function removeFromCart(index) {
      let cart = getCart();
      cart.splice(index, 1);
      saveCart(cart);
      renderCart();
      updateCartDisplay();
    }

    window.addEventListener('load', renderCart);
  </script>
</body>
</html>
  `);
});

app.get("/admin-panel", async (req, res) => {
  if (!req.session.authenticated) return res.redirect("/admin");

  const query = db.createQuery("storeItems").order("createdAt", { descending: true });
  const [items] = await db.runQuery(query);

  let itemsHtml = "";
  items.forEach(item => {
    const entityKey = item[Datastore.KEY];
    const itemId = entityKey.id || entityKey.name;
    const firstImage = item.imageUrls?.[0] || item.imageUrl || 'https://via.placeholder.com/400?text=No+Image';
    const isSoldOut = item.soldOut === true;

    itemsHtml += `
      <div class="admin-item ${isSoldOut ? 'sold-out' : ''}" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid rgba(0,255,80,0.2); border-radius: 12px; background: rgba(15,15,15,0.6);">
        <div style="display: flex; gap: 1.5rem; align-items: center;">
          <img src="${firstImage}" alt="${item.description}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(0,255,80,0.3);">
          <div style="flex: 1;">
            <h3 style="color: #00ff50; margin-bottom: 0.4rem;">${item.description}</h3>
            <div style="font-size: 1.4rem; color: #d0ffd0;">${formatNaira(item.price)}</div>
            <div style="margin-top: 0.5rem; font-size: 0.95rem; opacity: 0.8;">
              ID: ${itemId} • ${item.imageUrls?.length || 1} image(s)
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.8rem; min-width: 160px;">
            ${isSoldOut ? 
              `<button onclick="markAsAvailable('${itemId}')" style="background:#00cc44;color:#000;padding:0.7rem 1.2rem;border:none;border-radius:50px;cursor:pointer;font-weight:bold;">✓ Mark Available</button>` 
              : 
              `<button onclick="markAsSoldOut('${itemId}')" style="background:#ff8800;color:#000;padding:0.7rem 1.2rem;border:none;border-radius:50px;cursor:pointer;font-weight:bold;">Mark as Sold Out</button>`
            }
            <button onclick="deleteItem('${itemId}')" style="background:#ff0044;color:white;padding:0.7rem 1.2rem;border:none;border-radius:50px;cursor:pointer;font-weight:bold;">🗑 Delete Item</button>
          </div>
        </div>
        ${isSoldOut ? `<div style="margin-top:12px;color:#ff8800;font-weight:bold;text-align:center;">● SOLD OUT</div>` : ''}
      </div>
    `;
  });

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Admin Panel — LENG</title>
  ${sharedHead}
  ${sharedHead}
  <style>
    main { padding: 8rem 5% 6rem; max-width: 1100px; margin: 0 auto; }
    .box {
      background: rgba(10,10,10,0.75);
      border: 1px solid rgba(0,255,80,0.3);
      border-radius: 16px;
      padding: 3rem;
      backdrop-filter: blur(12px);
      box-shadow: 0 0 40px rgba(0,255,80,0.15);
      margin-bottom: 4rem;
    }
    h2 { color: #00ff50; text-shadow: 0 0 20px #00ff50; margin-bottom: 2rem; text-align: center; }
    input, textarea { width: 100%; padding: 1rem; margin: 0.8rem 0; border-radius: 10px; border: 1px solid rgba(0,255,80,0.3); background: #111; color: #e0ffe0; font-family: inherit; }
    textarea { min-height: 120px; resize: vertical; }
    button { width: 100%; padding: 1.2rem; margin-top: 2rem; background: #00ff50; color: #000; font-weight: 900; border: none; border-radius: 50px; cursor: pointer; font-size: 1.2rem; transition: all 0.3s; }
    button:hover { transform: translateY(-3px); box-shadow: 0 0 30px rgba(0,255,80,0.6); }
    .admin-item.sold-out { opacity: 0.75; border-color: #ff8800; }
    .admin-item.sold-out h3 { text-decoration: line-through; opacity: 0.7; }
  </style>
</head>
<body>
  ${sharedHeader}
  <main>
    <div class="box">
      <h2>UPLOAD NEW ITEM</h2>
      <form method="POST" action="/admin/upload" enctype="multipart/form-data">
        <input type="file" name="images" accept="image/*" multiple />
        <input name="price" type="number" step="0.01" placeholder="Price in Naira (e.g. 45000)" required />
        <textarea name="description" placeholder="Item description" required></textarea>
        <button type="submit">Upload to Store</button>
      </form>
    </div>
    <div class="box">
      <h2>MANAGE STORE ITEMS (${items.length})</h2>
      ${itemsHtml || '<p style="text-align:center; padding: 3rem; opacity:0.6;">No items in store yet.</p>'}
    </div>
  </main>
  ${sharedScripts}
  <script>
    function deleteItem(itemId) {
      if (confirm("⚠️ Are you sure you want to permanently delete this item?")) {
        fetch('/admin/delete/' + itemId, { method: 'POST' })
          .then(res => res.ok ? location.reload() : alert("Failed to delete item"))
          .catch(() => alert("Connection error"));
      }
    }

    function markAsSoldOut(itemId) {
      if (confirm("Mark this item as Sold Out?")) {
        fetch('/admin/soldout/' + itemId, { method: 'POST' })
          .then(res => res.ok ? location.reload() : alert("Failed to update status"))
          .catch(() => alert("Connection error"));
      }
    }

    function markAsAvailable(itemId) {
      if (confirm("Mark this item as Available again?")) {
        fetch('/admin/available/' + itemId, { method: 'POST' })
          .then(res => res.ok ? location.reload() : alert("Failed to update status"))
          .catch(() => alert("Connection error"));
      }
    }
  </script>
</body>
</html>
  `);
});

// ─── UPLOAD ITEM HANDLER ─────────────────────────────────────────────────────
app.post("/admin/upload", upload.array("images", 5), async (req, res) => {
  if (!req.session.authenticated) return res.redirect("/admin");

  const files = req.files;
  const price = req.body.price;
  const description = req.body.description;

  if (!files || files.length === 0) {
    return res.send("No images uploaded. <a href='/admin-panel'>Back</a>");
  }

  const imageUrls = [];
  for (const file of files) {
    const base64Image = file.buffer.toString("base64");
    const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: new URLSearchParams({ image: base64Image })
    });
    const imgbbJson = await imgbbRes.json();
    if (imgbbJson.success) imageUrls.push(imgbbJson.data.url);
  }

  if (imageUrls.length === 0) {
    return res.send("Image upload failed. <a href='/admin-panel'>Back</a>");
  }

  const key = db.key("storeItems");
  await db.save({
    key,
    data: {
      imageUrls,
      price: parseFloat(price),
      description,
      ratings: [],
      comments: [],
      createdAt: new Date(),
      soldOut: false
    }
  });

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head><title>Upload Success</title>${sharedHead}</head>
    <body>
      ${sharedHeader}
      <div style="padding:12rem 5%; text-align:center;">
        <h2 style="color:#00ff50; font-size:3rem;">ITEM UPLOADED SUCCESSFULLY!</h2>
        <p style="font-size:1.5rem; margin:2rem 0;">
          <a href="/store" style="color:#00ff50;">View in Store</a> | 
          <a href="/admin-panel" style="color:#00ff50;">Upload Another</a>
        </p>
      </div>
      ${sharedScripts}
    </body>
    </html>
  `);
});

// ─── DELETE ITEM ─────────────────────────────────────────────────────────────
app.post("/admin/delete/:id", async (req, res) => {
  if (!req.session.authenticated) return res.status(401).send("Unauthorized");

  const id = req.params.id;
  const key = isNaN(Number(id)) 
    ? db.key(["storeItems", id]) 
    : db.key(["storeItems", Number(id)]);

  try {
    await db.delete(key);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Delete failed");
  }
});
// ─── MARK AS SOLD OUT ────────────────────────────────────────────────────────
app.post("/admin/soldout/:id", async (req, res) => {
  if (!req.session.authenticated) return res.status(401).send("Unauthorized");

  const id = req.params.id;
  const key = isNaN(Number(id)) 
    ? db.key(["storeItems", id]) 
    : db.key(["storeItems", Number(id)]);

  try {
    const [item] = await db.get(key);
    if (!item) return res.status(404).send("Item not found");

    await db.update({ key, data: { ...item, soldOut: true } });
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Update failed");
  }
});

// ─── MARK AS AVAILABLE ───────────────────────────────────────────────────────
app.post("/admin/available/:id", async (req, res) => {
  if (!req.session.authenticated) return res.status(401).send("Unauthorized");

  const id = req.params.id;
  const key = isNaN(Number(id)) 
    ? db.key(["storeItems", id]) 
    : db.key(["storeItems", Number(id)]);

  try {
    const [item] = await db.get(key);
    if (!item) return res.status(404).send("Item not found");

    await db.update({ key, data: { ...item, soldOut: false } });
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Update failed");
  }
});

// ─── START SERVER ────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`LENG is live → http://0.0.0.0:${PORT}`);
  console.log("Ctrl+C to stop");
});