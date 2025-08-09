/* script.js
   Mantiene Firebase (usando tu config), votantes, bloqueo por usuario y actualización en tiempo real.
   Coloca este archivo en el mismo directorio y referencia desde index.html.
*/

/* --- CONFIGURACIÓN FIREBASE (usa la tuya) --- */
const firebaseConfig = {
  apiKey: "AIzaSyBN88SBoGAQl4cZRThrP0O1FOdHCaTH8BY",
  authDomain: "votacion-app-3da72.firebaseapp.com",
  databaseURL: "https://votacion-app-3da72-default-rtdb.firebaseio.com",
  projectId: "votacion-app-3da72",
  storageBucket: "votacion-app-3da72.firebasestorage.app",
  messagingSenderId: "800798438453",
  appId: "1:800798438453:web:a313724e37cbf3c4c42d7c",
  measurementId: "G-82MT9XJZVN"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* --- LISTA DE VOTANTES Y CANDIDATOS (sin cambios) --- */
const votantes = [
  { usuario: "votante01", pass: "lima82" },
  { usuario: "votante02", pass: "roca15" },
  { usuario: "votante03", pass: "sol94" },
  { usuario: "votante04", pass: "nube51" },
  { usuario: "votante05", pass: "pino73" },
  { usuario: "votante06", pass: "duna86" },
  { usuario: "votante07", pass: "ave19" },
  { usuario: "votante08", pass: "mar47" },
  { usuario: "votante09", pass: "flor28" },
  { usuario: "votante10", pass: "luz64" },
  { usuario: "votante11", pass: "rio93" },
  { usuario: "votante12", pass: "ola52" },
  { usuario: "votante13", pass: "solano71" },
  { usuario: "votante14", pass: "lago38" },
  { usuario: "votante15", pass: "nilo45" },
  { usuario: "votante16", pass: "paz83" },
  { usuario: "votante17", pass: "toro56" }
];

const opciones = ["Ivan Lizarme", "Jhon Ochante"];
let votos = {};            // objeto con conteo: { "Ivan Lizarme": 0, ... }
let usuarioActual = null;  // string con usuario actual

/* --- UTIL: crear id seguro para elementos (espacios -> guiones) --- */
function safeId(label) {
  return label.replace(/\s+/g, "-").replace(/[^\w-]/g, "");
}

/* --- RENDER: dibuja opciones y admin --- */
function renderOptions(votosObj = {}) {
  const voteContainer = document.getElementById("options-container");
  const adminContainer = document.getElementById("admin-options");
  voteContainer.innerHTML = "";
  adminContainer.innerHTML = "";

  opciones.forEach(op => {
    const sid = safeId(op);
    const count = votosObj[op] || 0;

    // fila votante
    const row = document.createElement("div");
    row.className = "option";
    row.innerHTML = `
      <span class="name">${op}</span>
      <div style="display:flex;gap:8px;align-items:center;">
        <span class="meta" id="votos-${sid}">${count}</span>
        <button class="btn btn-vote" onclick="vote('${op}')" aria-label="Votar por ${op}">Votar</button>
      </div>
    `;
    voteContainer.appendChild(row);

    // admin
    const p = document.createElement("p");
    p.innerHTML = `${op}: <strong id="admin-votos-${sid}">${count}</strong>`;
    adminContainer.appendChild(p);
  });

  // total
  const totalSpan = document.getElementById("total-votos");
  const total = Object.values(votosObj).reduce((a,b) => a + b, 0);
  if (totalSpan) totalSpan.textContent = total;
}

/* --- ACTUALIZAR contadores en pantalla (evita redibujar botones) --- */
function actualizarVotos(votosObj = {}) {
  opciones.forEach(op => {
    const sid = safeId(op);
    const count = votosObj[op] || 0;
    const userSpan = document.getElementById(`votos-${sid}`);
    const adminSpan = document.getElementById(`admin-votos-${sid}`);
    if (userSpan) userSpan.textContent = count;
    if (adminSpan) adminSpan.textContent = count;
  });
  const totalSpan = document.getElementById("total-votos");
  if (totalSpan) totalSpan.textContent = Object.values(votosObj).reduce((a,b) => a + b, 0);
}

/* --- ESCUCHAR cambios en Firebase (en tiempo real) --- */
db.ref("votos").on("value", snap => {
  votos = snap.val() || {};
  // asegurar claves de candidatos
  opciones.forEach(op => { if (!(op in votos)) votos[op] = 0; });
  renderOptions(votos);
  actualizarVotos(votos);
});

/* --- LOGIN --- */
function login() {
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();
  const err = document.getElementById("login-error");
  err.textContent = "";

  if (!user || !pass) {
    err.textContent = "Por favor completa usuario y contraseña.";
    return;
  }

  // admin
  if (user === "admin" && pass === "9719") {
    usuarioActual = "admin";
    document.getElementById("login-container").style.display = "none";
    document.getElementById("admin-container").style.display = "block";
    // render inmediatamente con los datos actuales (ya están escuchando)
    return;
  }

  // votante: validar contra lista local
  const votante = votantes.find(v => v.usuario === user && v.pass === pass);
  if (!votante) {
    err.textContent = "Usuario o contraseña incorrectos.";
    return;
  }

  // verificar en Firebase si ya votó
  db.ref(`votosUsuarios/${user}`).once("value").then(snap => {
    if (snap.exists() && snap.val() === true) {
      err.textContent = "Ya has votado antes.";
      return;
    }
    // permitir votar
    usuarioActual = user;
    localStorage.setItem("usuarioActual", user); // guardar localmente para persistencia de sesión
    document.getElementById("login-container").style.display = "none";
    document.getElementById("vote-container").style.display = "block";
  }).catch(e => {
    console.error("Error comprobando voto en Firebase:", e);
    err.textContent = "Error de red. Intenta de nuevo.";
  });
}

/* --- VOTAR --- */
function vote(option) {
  if (!usuarioActual) {
    alert("Debes iniciar sesión para votar.");
    return;
  }

  // comprobación final en Firebase: si ya votó abortar
  db.ref(`votosUsuarios/${usuarioActual}`).once("value").then(snap => {
    if (snap.exists() && snap.val() === true) {
      alert("Ya has votado.");
      return;
    }

    // incrementar con transaction (seguro para concurrencia)
    db.ref(`votos/${option}`).transaction(current => (current || 0) + 1, (err, committed) => {
      if (err) {
        console.error("Transaction error:", err);
        alert("No se pudo registrar el voto. Intenta otra vez.");
        return;
      }
      if (!committed) {
        alert("El voto no se pudo completar.");
        return;
      }
      // marcar usuario como que ya votó
      db.ref(`votosUsuarios/${usuarioActual}`).set(true)
        .then(() => {
          // además guardamos localmente para UX offline
          localStorage.setItem(`voto_${usuarioActual}`, "true");
          alert("¡Voto registrado!");
        })
        .catch(e => {
          console.error("Error marcando voto de usuario:", e);
          alert("Voto registrado pero hubo un problema marcando tu cuenta.");
        });
    });
  }).catch(e => {
    console.error("Error comprobando voto antes de votar:", e);
    alert("Error de red. Intenta otra vez.");
  });
}

/* --- LOGOUT --- */
function logout() {
  usuarioActual = null;
  localStorage.removeItem("usuarioActual");
  document.getElementById("login-container").style.display = "block";
  document.getElementById("vote-container").style.display = "none";
  document.getElementById("admin-container").style.display = "none";
}

/* --- Inicial: si había sesión guardada localmente restablecer (opcional) --- */
(function restoreSession(){
  const saved = localStorage.getItem("usuarioActual");
  if (saved) {
    // comprobamos si es admin o votante
    if (saved === "admin") {
      usuarioActual = "admin";
      document.getElementById("login-container").style.display = "none";
      document.getElementById("admin-container").style.display = "block";
      return;
    }
    // verificar en firebase que aún puede votar (o permitir ver)
    db.ref(`votosUsuarios/${saved}`).once("value").then(snap => {
      if (snap.exists() && snap.val() === true) {
        // ya votó, mostrar login con mensaje o mantener en login
        localStorage.removeItem("usuarioActual");
        return;
      }
      usuarioActual = saved;
      document.getElementById("login-container").style.display = "none";
      document.getElementById("vote-container").style.display = "block";
    }).catch(()=>{ /* ignore */ });
  }
})();
