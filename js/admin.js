/**
 * ==========================================================================
 * ADMIN.JS - PANEL DE CONTROL Y ESCÁNER QR EN VIVO
 * Verificación el día del evento, búsqueda, check-in con cámara continua
 * y celebración en pantalla por 3 segundos.
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
  const config = window.APP_CONFIG;
  const dbService = window.dbService;

  // Elementos de Autenticación
  const loginOverlay = document.getElementById("admin-login-overlay");
  const loginForm = document.getElementById("admin-login-form");
  const inputUser = document.getElementById("admin-user");
  const inputPass = document.getElementById("admin-pass");

  // Elementos de Navegación de Pestañas
  const tabBtns = document.querySelectorAll(".btn-admin-nav");
  const tabPanes = document.querySelectorAll(".tab-pane");

  // Métricas
  const statOccupied = document.getElementById("stat-occupied");
  const statFree = document.getElementById("stat-free");
  const statEntered = document.getElementById("stat-entered");
  const statHistorical = document.getElementById("stat-historical");

  // Tabla de Puestos
  const slotsTableBody = document.getElementById("slots-table-body");
  const searchInput = document.getElementById("admin-search-input");
  const filterBtns = document.querySelectorAll(".filter-btn");

  // Escáner QR
  const btnToggleScanner = document.getElementById("btn-toggle-scanner");
  const btnFlipCamera = document.getElementById("btn-flip-camera");
  const scannerStatusText = document.getElementById("scanner-status-text");
  const scannerLaser = document.getElementById("scanner-laser");

  // Celebración de 3 Segundos
  const celebrationOverlay = document.getElementById("celebration-overlay");
  const celebrationGuestName = document.getElementById("celebration-guest-name");
  const celebrationSlotInfo = document.getElementById("celebration-slot-info");

  // Historial Completo
  const historyTableBody = document.getElementById("history-table-body");
  const btnExportCsv = document.getElementById("btn-export-csv");

  // Estado del Admin
  let currentDb = null;
  let activeFilter = "all";
  let html5QrScanner = null;
  let isScanning = false;
  let currentFacingMode = "environment"; // Cámara trasera por defecto
  let scanCooldown = false;

  // 1. Comprobar Sesión
  checkAuthentication();

  function checkAuthentication() {
    const isLoggedIn = sessionStorage.getItem("sara15_admin_authenticated");
    if (isLoggedIn === "true") {
      loginOverlay.style.display = "none";
      loadAdminData();
    } else {
      loginOverlay.style.display = "flex";
    }
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = inputUser.value.trim();
      const pass = inputPass.value.trim();

      // 1_ARQUITECTURA_DE_SEGURIDAD_OBSCURA: Autenticación 100% Serverless
      const btnSubmit = document.querySelector(".btn-login-submit");
      const originalText = btnSubmit.innerHTML;
      btnSubmit.innerHTML = `<span class="spinner" style="width:15px;height:15px;border-width:2px;margin-right:8px;"></span> Encriptando túnel...`;
      btnSubmit.disabled = true;

      try {
        const response = await fetch(config.BACKEND_API_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "admin_login",
            user: user,
            pass: pass
          })
        });
        
        const res = await response.json();

        if (res.success && res.token === "VIP_AUTH_GRANTED") {
          sessionStorage.setItem("sara15_admin_authenticated", "true");
          loginOverlay.style.display = "none";
          loadAdminData();
          showToast("Acceso Concedido: Conexión segura establecida.", "success");
        } else {
          showToast("Acceso Denegado. Anomalía detectada.", "error");
        }
      } catch(err) {
        showToast("Brecha de red: El servidor maestro no responde.", "error");
      } finally {
        btnSubmit.innerHTML = originalText;
        btnSubmit.disabled = false;
      }
    });
  }

  // 2. Control de Pestañas
  tabBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      tabBtns.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetTab = btn.getAttribute("data-tab");
      document.getElementById(targetTab).classList.add("active");

      if (targetTab === "tab-scanner") {
        if (!isScanning) startQrScanner();
      } else {
        if (isScanning) stopQrScanner();
      }
    });
  });

  // ==========================================
  // CARGA Y ACTUALIZACIÓN DE DATOS
  // ==========================================

  async function loadAdminData() {
    try {
      currentDb = await dbService.fetchDatabase();
      renderStats();
      renderSlotsTable();
      renderHistoryTable();
    } catch (err) {
      console.error("Error al cargar datos de admin:", err);
      showToast("Error al sincronizar base de datos.", "error");
    }
  }

  function renderStats() {
    if (!currentDb || !currentDb.slots) return;

    let occupied = 0;
    let entered = 0;

    currentDb.slots.forEach(s => {
      if (s.guest) {
        occupied++;
        if (s.guest.checked_in) entered++;
      }
    });

    const free = 90 - occupied;
    const historyCount = (currentDb.all_time_guests || []).length;

    statOccupied.textContent = `${occupied} / 90`;
    statFree.textContent = `${free}`;
    statEntered.textContent = `${entered}`;
    statHistorical.textContent = `${historyCount}`;
  }

  // ==========================================
  // TABLA DE PUESTOS (90 CUPOS) Y BÚSQUEDA
  // ==========================================

  function renderSlotsTable() {
    if (!currentDb || !slotsTableBody) return;

    const searchTerm = (searchInput.value || "").toLowerCase().trim();
    slotsTableBody.innerHTML = "";

    const filteredSlots = currentDb.slots.filter(s => {
      // Filtro por estado
      if (activeFilter === "occupied" && !s.guest) return false;
      if (activeFilter === "free" && s.guest) return false;
      if (activeFilter === "entered" && (!s.guest || !s.guest.checked_in)) return false;

      // Filtro por término de búsqueda (Nombre, Documento, Código)
      if (searchTerm) {
        if (!s.guest) return false;
        const nameMatch = (s.guest.name || "").toLowerCase().includes(searchTerm);
        const docMatch = (s.guest.document || "").includes(searchTerm);
        const codeMatch = (s.guest.code || "").toLowerCase().includes(searchTerm);
        return nameMatch || docMatch || codeMatch;
      }

      return true;
    });

    if (filteredSlots.length === 0) {
      slotsTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #888; padding: 25px;">No se encontraron puestos que coincidan con la búsqueda.</td></tr>`;
      return;
    }

    filteredSlots.forEach(s => {
      const tr = document.createElement("tr");
      const guest = s.guest;

      let statusBadge = "";
      let actions = "";

      if (!guest) {
        statusBadge = `<span class="status-tag free">Libre</span>`;
        actions = `<span style="color: #666; font-size: 11px;">Disponible</span>`;
      } else if (guest.checked_in) {
        statusBadge = `<span class="status-tag entered">✓ Ingresó (${new Date(guest.checked_in_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</span>`;
        actions = `<span style="color: #2ecc71; font-weight: bold; font-size: 11px;">Pase Utilizado</span>`;
      } else {
        statusBadge = `<span class="status-tag occupied">Confirmado</span>`;
        actions = `<button class="btn-manual-checkin" data-code="${guest.code}">Marcar Ingreso</button>`;
      }

      tr.innerHTML = `
        <td><span class="slot-badge">#${s.slot}</span></td>
        <td>${statusBadge}</td>
        <td><strong>${guest ? guest.name : "-"}</strong></td>
        <td>${guest ? guest.document : "-"}</td>
        <td><span style="font-size: 12px; color: #aaa;">${guest ? guest.email : "-"}</span></td>
        <td>${guest ? (guest.is_leader ? '<span style="color: var(--gold-light); font-weight: bold;">👑 Líder</span>' : 'Acompañante') : "-"}</td>
        <td>${guest ? `<code>${guest.code}</code>` : "-"}</td>
        <td>${actions}</td>
      `;

      slotsTableBody.appendChild(tr);
    });

    // Asignar listeners a botones de check-in manual
    slotsTableBody.querySelectorAll(".btn-manual-checkin").forEach(btn => {
      btn.addEventListener("click", async () => {
        const code = btn.getAttribute("data-code");
        btn.setAttribute("disabled", "true");
        btn.innerHTML = `<span class="spinner"></span>`;
        await executeCheckIn(code);
      });
    });
  }

  // Escucha de Búsqueda instantánea
  if (searchInput) {
    searchInput.addEventListener("input", renderSlotsTable);
  }

  // Filtros de estado
  filterBtns.forEach(fBtn => {
    fBtn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      fBtn.classList.add("active");
      activeFilter = fBtn.getAttribute("data-filter");
      renderSlotsTable();
    });
  });

  // ==========================================
  // ESCÁNER QR EN VIVO CON AUTODETECCIÓN CONTINUA
  // ==========================================

  async function startQrScanner() {
    if (!window.Html5Qrcode) {
      showToast("Librería de escaneo de QR no disponible.", "error");
      return;
    }

    try {
      if (!html5QrScanner) {
        html5QrScanner = new Html5Qrcode("reader");
      }

      const qrConfig = {
        fps: 15, // Detección rápida continua
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await html5QrScanner.start(
        { facingMode: currentFacingMode },
        qrConfig,
        onQrCodeScanned,
        onQrScanFailure
      );

      isScanning = true;
      scannerStatusText.textContent = "Cámara activa. Apunta hacia el código QR del invitado...";
      scannerLaser.style.display = "block";
      btnToggleScanner.textContent = "Detener Cámara";

    } catch (err) {
      console.error("Error al iniciar cámara:", err);
      scannerStatusText.textContent = "No se pudo acceder a la cámara. Revisa los permisos.";
      showToast("Error de acceso a la cámara: " + err, "error");
    }
  }

  async function stopQrScanner() {
    if (html5QrScanner && isScanning) {
      try {
        await html5QrScanner.stop();
        isScanning = false;
        scannerLaser.style.display = "none";
        scannerStatusText.textContent = "Cámara en pausa.";
        btnToggleScanner.textContent = "Iniciar Cámara";
      } catch (e) {
        console.warn("Error al detener cámara:", e);
      }
    }
  }

  if (btnToggleScanner) {
    btnToggleScanner.addEventListener("click", () => {
      if (isScanning) {
        stopQrScanner();
      } else {
        startQrScanner();
      }
    });
  }

  // Alternar cámara (Frontal / Trasera)
  if (btnFlipCamera) {
    btnFlipCamera.addEventListener("click", async () => {
      currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
      if (isScanning) {
        await stopQrScanner();
        await startQrScanner();
        showToast(`Cámara cambiada a: ${currentFacingMode === "user" ? "Frontal" : "Trasera"}`, "info");
      }
    });
  }

  function onQrScanFailure(error) {
    // Escaneo continuo sin spam
  }

  // Callback al detectar un QR automáticamente
  async function onQrCodeScanned(decodedText) {
    if (scanCooldown) return;
    scanCooldown = true;

    // 1. Congelar cámara visualmente para evitar escaneos fantasma
    if (html5QrScanner.getState() === Html5QrcodeScannerState.SCANNING) {
        html5QrScanner.pause();
    }

    const cleanCode = decodedText.trim();
    await executeCheckIn(cleanCode);

    // 2. Sincronizar el rearmado de la cámara con el cierre del modal de celebración (3s)
    setTimeout(() => {
        scanCooldown = false;
        if (html5QrScanner.getState() === Html5QrcodeScannerState.PAUSED) {
            html5QrScanner.resume();
        }
    }, 3000);
  }

  // ==========================================
  // EJECUCIÓN DE CHECK-IN Y CELEBRACIÓN DE 3 SEGUNDOS
  // ==========================================

  async function executeCheckIn(code) {
    try {
      const res = await dbService.checkInGuest(code);

      if (res.success) {
        // 1. Reproducir sonido de bienvenida
        playCelebrationSound();

        // 2. Mostrar pantalla de celebración durante exactamente 3 segundos
        celebrationGuestName.textContent = res.guest.name;
        celebrationSlotInfo.textContent = `Puesto Oficial Asignado: #${res.slot}`;
        celebrationOverlay.classList.add("active");
        
        // 4_SINCRONIZACIÓN_DE_FLUJO_ULTRA_ESTRICTO_RSVP: Estallido de confeti
        triggerConfettiExplosion();

        // Actualizar datos de tablas
        await loadAdminData();

        // Requisito: En la pantalla dice por 3 segundos 'bienvenid@ a la fiesta (nombre)'
        setTimeout(() => {
            celebrationOverlay.classList.remove("active");
            removeConfettiCanvas();
        }, 3000);

      } else {
        if (res.reason === "already_checked_in") {
          showToast(res.message, "warning");
        } else {
          showToast("Código no válido o no está en los 90 puestos activos.", "error");
        }
      }
    } catch (e) {
      console.error("Error al procesar check-in:", e);
      showToast("Error al procesar el ingreso.", "error");
    }
  }

  // ==========================================
  // HISTORIAL COMPLETO Y EXPORTACIÓN CSV
  // ==========================================

  function renderHistoryTable() {
    if (!currentDb || !historyTableBody) return;
    historyTableBody.innerHTML = "";

    const allGuests = currentDb.all_time_guests || [];
    if (allGuests.length === 0) {
      historyTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #888; padding: 20px;">No hay registros en el historial todavía.</td></tr>`;
      return;
    }

    allGuests.forEach((g, index) => {
      const tr = document.createElement("tr");

      let statusBadge = "";
      if (g.status === "cancelled") {
        statusBadge = `<span class="status-tag" style="background: rgba(220, 53, 69, 0.2); color: #ff8595; border: 1px solid #dc3545;">Cancelado</span>`;
      } else if (g.checked_in) {
        statusBadge = `<span class="status-tag entered">Asistió / Ingresó</span>`;
      } else {
        statusBadge = `<span class="status-tag occupied">Activo</span>`;
      }

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td><strong>${g.name}</strong></td>
        <td>${g.document}</td>
        <td>${g.email}</td>
        <td><code>${g.code}</code></td>
        <td>${statusBadge}</td>
        <td style="font-size: 11px; color: #aaa;">${new Date(g.registered_at).toLocaleString()}</td>
      `;

      historyTableBody.appendChild(tr);
    });
  }

  if (btnExportCsv) {
    btnExportCsv.addEventListener("click", () => {
      if (!currentDb || !currentDb.all_time_guests) return;
      const guests = currentDb.all_time_guests;

      let csv = "Nombre,Documento,Email,Codigo,Rol,Estado,Ingreso,FechaRegistro\n";
      guests.forEach(g => {
        csv += `"${g.name}","${g.document}","${g.email}","${g.code}","${g.is_leader ? 'Lider' : 'Acompañante'}","${g.status || 'activo'}","${g.checked_in ? 'Si' : 'No'}","${g.registered_at}"\n`;
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Sara15_Lista_Invitados_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Sonido de fanfarria suave con Web Audio API
  function playCelebrationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + idx * 0.12 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.35);
      });
    } catch (e) {}
  }
  // ==========================================
  // SISTEMA DE PARTÍCULAS CONFETI DIGITAL
  // ==========================================
  function triggerConfettiExplosion() {
    const canvas = document.createElement("canvas");
    canvas.id = "confetti-canvas";
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "100000";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ["#F249E7", "#fff2b2", "#e5c378", "#ffffff"];
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2 + 100,
        vx: (Math.random() - 0.5) * 25,
        vy: (Math.random() - 1) * 25,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.floor(Math.random() * 10) - 10,
        tiltAngle: 0,
        tiltAngleInc: (Math.random() * 0.07) + 0.05
      });
    }

    let animationFrame;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.tiltAngle += p.tiltAngleInc;
        p.y += (Math.cos(p.tiltAngle) + 1 + p.size / 2) / 2;
        p.x += Math.sin(p.tiltAngle) * 2 + p.vx;
        p.vy += 0.5; // Gravedad
        p.y += p.vy;

        ctx.beginPath();
        ctx.lineWidth = p.size;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.size, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.size);
        ctx.stroke();
      });
      animationFrame = requestAnimationFrame(render);
    }
    render();
    canvas.dataset.frame = animationFrame;
  }

  function removeConfettiCanvas() {
    const canvas = document.getElementById("confetti-canvas");
    if (canvas) {
      cancelAnimationFrame(canvas.dataset.frame);
      canvas.remove();
    }
  }
});
