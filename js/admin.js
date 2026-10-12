/**
 * ==========================================================================
 * ADMIN.JS - PANEL DE CONTROL Y ESCÁNER QR EN VIVO
 * Verificación el día del evento, búsqueda, check-in con cámara continua,
 * purga directa en GitHub y celebración en pantalla por 3 segundos.
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
  const config = window.APP_CONFIG;
  const dbService = window.dbService;

  // Sanitizador de seguridad contra XSS
  function escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

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
  let currentFacingMode = "environment";
  let scanCooldown = false;

  // 1. Comprobar Sesión
  checkAuthentication();

  function checkAuthentication() {
    const isLoggedIn = sessionStorage.getItem("sara15_admin_authenticated");
    if (isLoggedIn === "true") {
      if (loginOverlay) loginOverlay.style.display = "none";
      loadAdminData();
    } else {
      if (loginOverlay) loginOverlay.style.display = "flex";
    }
  }

  // ==========================================
  // INICIO DE SESIÓN DEL ADMINISTRADOR
  // ==========================================
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const user = inputUser.value.trim();
      const pass = inputPass.value.trim();

      if (!user || !pass) {
        window.showTopNotice("Por favor ingresa usuario y contraseña.", "error", 3000);
        return;
      }

      const btnSubmit = loginForm.querySelector(".btn-login-submit");
      const originalText = btnSubmit ? btnSubmit.innerHTML : "Ingresar";
      if (btnSubmit) {
        btnSubmit.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:8px;vertical-align:middle;"></span> Verificando...`;
        btnSubmit.disabled = true;
      }

      window.showTopNotice("Autenticando credenciales de administrador...", "loading");

      let authSuccess = false;

      // 1. Intentar validar con backend
      if (config.BACKEND_API_URL && config.BACKEND_API_URL.startsWith("http")) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const response = await fetch(config.BACKEND_API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ 
              action: "admin_login", 
              user: user, 
              pass: pass 
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const res = await response.json();
            if (res && res.success && res.token === "VIP_AUTH_GRANTED") {
              authSuccess = true;
            }
          }
        } catch (err) {
          console.warn("Validación de login en backend no disponible:", err);
        }
      }

      // 2. Fallback de credenciales maestras si backend no está disponible o variables no configuradas
      if (!authSuccess) {
        if ((user === "admin" && pass === "Sara15Admin2026") || 
            (user === "admin" && pass === "SaraVIP2026") ||
            (user === "maoaza13579@gmail.com" && pass === "SaraVIP2026")) {
          authSuccess = true;
        }
      }

      if (btnSubmit) {
        btnSubmit.innerHTML = originalText;
        btnSubmit.disabled = false;
      }

      if (authSuccess) {
        sessionStorage.setItem("sara15_admin_authenticated", "true");
        if (loginOverlay) loginOverlay.style.display = "none";
        window.showTopNotice("Bienvenido al Dashboard de Administración", "success", 3000);
        await loadAdminData();
      } else {
        window.showTopNotice("Credenciales incorrectas. Acceso denegado.", "error", 4000);
      }
    });
  }

  // ==========================================
  // CONTROL DE PESTAÑAS
  // ==========================================
  tabBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      tabBtns.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetTab = btn.getAttribute("data-tab");
      const targetPane = document.getElementById(targetTab);
      if (targetPane) targetPane.classList.add("active");

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
    window.showTopNotice("Sincronizando base de datos en tiempo real...", "loading");
    try {
      currentDb = await dbService.fetchDatabase(true);
      renderStats();
      renderSlotsTable();
      renderHistoryTable();
      window.hideTopNotice();
    } catch (err) {
      console.error("Error al cargar datos de admin:", err);
      window.showTopNotice("Error al sincronizar base de datos.", "error", 4000);
    }
  }

  function renderStats() {
    if (!currentDb || !currentDb.slots) return;

    let occupied = 0;
    let entered = 0;

    currentDb.slots.forEach(s => {
      if (s && s.guest) {
        occupied++;
        if (s.guest.checked_in) entered++;
      }
    });

    const free = Math.max(0, 90 - occupied);
    const historyCount = (currentDb.all_time_guests || []).length;

    if (statOccupied) statOccupied.textContent = `${occupied} / 90`;
    if (statFree) statFree.textContent = `${free}`;
    if (statEntered) statEntered.textContent = `${entered}`;
    if (statHistorical) statHistorical.textContent = `${historyCount}`;
  }

  // ==========================================
  // TABLA DE PUESTOS (90 CUPOS) Y BÚSQUEDA
  // ==========================================
  function renderSlotsTable() {
    if (!currentDb || !slotsTableBody) return;

    const searchTerm = (searchInput.value || "").toLowerCase().trim();
    slotsTableBody.innerHTML = "";

    const filteredSlots = currentDb.slots.filter(s => {
      if (!s) return false;

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
        actions = `<span style="color:#666; font-size:11px;">Disponible</span>`;
      } else if (guest.checked_in) {
        statusBadge = `<span class="status-tag entered">✓ Ingresó</span>`;
        actions = `
          <div style="display: flex; gap: 6px;">
            <span style="color:#2ecc71; font-size:11px; align-self:center;">Ingresado</span>
            <button class="btn-admin-cancel-slot" data-code="${escapeHtml(guest.code)}" data-slot="${s.slot}" title="Dar de baja y liberar puesto en GitHub" style="background: rgba(220,53,69,0.15); border: 1px solid #dc3545; color: #ff8595; padding: 5px 10px; border-radius: 12px; font-size: 11px; cursor: pointer;">Dar de baja</button>
          </div>
        `;
      } else {
        statusBadge = `<span class="status-tag occupied">Confirmado</span>`;
        actions = `
          <div style="display: flex; gap: 6px;">
            <button class="btn-manual-checkin" data-code="${escapeHtml(guest.code)}">Ingresar</button>
            <button class="btn-admin-cancel-slot" data-code="${escapeHtml(guest.code)}" data-slot="${s.slot}" title="Dar de baja y liberar puesto en GitHub" style="background: rgba(220,53,69,0.15); border: 1px solid #dc3545; color: #ff8595; padding: 5px 10px; border-radius: 12px; font-size: 11px; cursor: pointer;">Dar de baja</button>
          </div>
        `;
      }

      tr.innerHTML = `
        <td><span class="slot-badge">#${s.slot}</span></td>
        <td>${statusBadge}</td>
        <td style="font-weight: 600; color: #fff;">${guest ? escapeHtml(guest.name) : "-"}</td>
        <td>${guest ? escapeHtml(guest.document) : "-"}</td>
        <td>${guest ? escapeHtml(guest.email) : "-"}</td>
        <td>${guest ? (guest.is_leader ? '<span style="color:var(--gold-accent);">👑 Líder</span>' : '👥 Acompañante') : "-"}</td>
        <td style="font-family: monospace; color: var(--primary-light);">${guest ? `${escapeHtml(guest.code)}` : "-"}</td>
        <td>${actions}</td>
      `;
      slotsTableBody.appendChild(tr);
    });

    // Listeners Check-in manual
    slotsTableBody.querySelectorAll(".btn-manual-checkin").forEach(btn => {
      btn.addEventListener("click", async () => {
        const code = btn.getAttribute("data-code");
        btn.setAttribute("disabled", "true");
        btn.innerHTML = `...`;
        await executeCheckIn(code);
      });
    });

    // Listeners Purga / Dar de baja
    slotsTableBody.querySelectorAll(".btn-admin-cancel-slot").forEach(btn => {
      btn.addEventListener("click", async () => {
        const code = btn.getAttribute("data-code");
        const slot = btn.getAttribute("data-slot");

        if (confirm(`⚠️ ADMINISTRADOR: ¿Estás seguro de dar de baja el puesto #${slot}? Se eliminará de la base de datos en GitHub y quedará libre para nuevos invitados.`)) {
          btn.setAttribute("disabled", "true");
          btn.innerHTML = `<span class="spinner" style="width:10px;height:10px;border-width:2px;"></span>`;
          window.showTopNotice(`Dando de baja el puesto #${slot} y actualizando GitHub...`, "loading");

          try {
            await dbService.cancelAttendance(code, { cancelAllGroup: false, purgeFull: true });
            window.showTopNotice(`Puesto #${slot} dado de baja exitosamente en GitHub.`, "success", 4000);
            await loadAdminData();
          } catch (e) {
            console.error("Error al dar de baja:", e);
            window.showTopNotice(e.message || "Error al dar de baja en GitHub.", "error", 5000);
            btn.removeAttribute("disabled");
            btn.innerHTML = `Dar de baja`;
          }
        }
      });
    });
  }

  // Búsqueda instantánea
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
      window.showTopNotice("Librería de escaneo de QR no disponible.", "error", 3500);
      return;
    }

    try {
      if (!html5QrScanner) {
        html5QrScanner = new Html5Qrcode("reader");
      }

      const qrConfig = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await html5QrScanner.start(
        { facingMode: currentFacingMode },
        qrConfig,
        onQrCodeScanned,
        () => {}
      );

      isScanning = true;
      if (scannerStatusText) scannerStatusText.textContent = "Cámara activa. Apunta hacia el código QR del invitado...";
      if (scannerLaser) scannerLaser.style.display = "block";
      if (btnToggleScanner) btnToggleScanner.textContent = "Detener Cámara";

    } catch (err) {
      console.error("Error al iniciar cámara:", err);
      if (scannerStatusText) scannerStatusText.textContent = "No se pudo acceder a la cámara. Revisa los permisos.";
      window.showTopNotice("Error de acceso a la cámara: " + err, "error", 4000);
    }
  }

  async function stopQrScanner() {
    if (html5QrScanner && isScanning) {
      try {
        await html5QrScanner.stop();
        isScanning = false;
        if (scannerStatusText) scannerStatusText.textContent = "Cámara en espera. Haz clic en 'Iniciar Cámara' para comenzar.";
        if (scannerLaser) scannerLaser.style.display = "none";
        if (btnToggleScanner) btnToggleScanner.textContent = "Iniciar Cámara";
      } catch (e) {}
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

  if (btnFlipCamera) {
    btnFlipCamera.addEventListener("click", async () => {
      currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
      if (isScanning) {
        await stopQrScanner();
        await startQrScanner();
      }
    });
  }

  async function onQrCodeScanned(decodedText) {
    if (scanCooldown) return;
    scanCooldown = true;

    await executeCheckIn(decodedText);

    setTimeout(() => {
      scanCooldown = false;
    }, 2500);
  }

  // ==========================================
  // EJECUCIÓN DEL CHECK-IN Y CELEBRACIÓN DE 3 SEGUNDOS
  // ==========================================
  async function executeCheckIn(code) {
    window.showTopNotice("Procesando check-in...", "loading");

    try {
      const result = await dbService.checkInGuest(code);

      if (!result.success) {
        if (result.reason === "already_checked_in") {
          window.showTopNotice(`⚠️ ${result.message}`, "warning", 5000);
        } else {
          window.showTopNotice(`❌ ${result.message}`, "error", 4500);
        }
        await loadAdminData();
        return;
      }

      window.hideTopNotice();

      // Disparar Celebración visual de 3 segundos
      triggerCelebrationOverlay(result.guest, result.slot);
      await loadAdminData();

    } catch (err) {
      console.error("Error en check-in:", err);
      window.showTopNotice("Error al procesar check-in: " + err.message, "error", 4500);
    }
  }

  function triggerCelebrationOverlay(guest, slot) {
    if (!celebrationOverlay) return;

    if (celebrationGuestName) celebrationGuestName.textContent = guest.name;
    if (celebrationSlotInfo) celebrationSlotInfo.textContent = `Puesto Asignado: #${slot} de 90`;

    celebrationOverlay.classList.add("active");

    const progressEl = celebrationOverlay.querySelector(".celebration-timer-progress");
    if (progressEl) {
      progressEl.style.transition = "none";
      progressEl.style.width = "100%";
      setTimeout(() => {
        progressEl.style.transition = "width 3s linear";
        progressEl.style.width = "0%";
      }, 50);
    }

    if (window.triggerGuestConfetti) {
      window.triggerGuestConfetti();
    }

    setTimeout(() => {
      celebrationOverlay.classList.remove("active");
    }, 3200);
  }

  // ==========================================
  // HISTORIAL Y EXPORTACIÓN A CSV / EXCEL
  // ==========================================
  function renderHistoryTable() {
    if (!currentDb || !historyTableBody) return;

    const list = currentDb.all_time_guests || [];
    historyTableBody.innerHTML = "";

    if (list.length === 0) {
      historyTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #888; padding: 25px;">No hay registros históricos aún.</td></tr>`;
      return;
    }

    list.forEach((g, idx) => {
      const tr = document.createElement("tr");
      let statusHtml = "";
      if (g.status === "active") {
        statusHtml = `<span class="status-tag occupied">Activo</span>`;
      } else if (g.status === "cancelled") {
        statusHtml = `<span class="status-tag" style="background:rgba(220,53,69,0.15);color:#ff8595;border:1px solid #dc3545;">Cancelado</span>`;
      } else {
        statusHtml = `<span class="status-tag">${escapeHtml(g.status || "-")}</span>`;
      }

      const dateStr = g.registered_at ? new Date(g.registered_at).toLocaleString() : "-";

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td style="color:#fff; font-weight:600;">${escapeHtml(g.name)}</td>
        <td>${escapeHtml(g.document)}</td>
        <td>${escapeHtml(g.email)}</td>
        <td style="font-family: monospace; color:var(--primary-light);">${escapeHtml(g.code)}</td>
        <td>${statusHtml}</td>
        <td style="font-size: 12px; color:#aaa;">${dateStr}</td>
      `;
      historyTableBody.appendChild(tr);
    });
  }

  if (btnExportCsv) {
    btnExportCsv.addEventListener("click", () => {
      if (!currentDb || !currentDb.slots) return;

      let csv = "Puesto,Estado,Invitado,Documento,Correo,Tipo,Codigo,Ingreso,Hora_Ingreso\n";
      currentDb.slots.forEach(s => {
        const g = s.guest;
        if (g) {
          csv += `"${s.slot}","${g.checked_in ? 'Ingresado' : 'Confirmado'}","${g.name}","${g.document}","${g.email}","${g.is_leader ? 'Lider' : 'Acompanante'}","${g.code}","${g.checked_in ? 'SI' : 'NO'}","${g.checked_in_at || ''}"\n`;
        } else {
          csv += `"${s.slot}","Libre","","","","","","",""\n`;
        }
      });

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asistencias_15_sara_sofia_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      window.showTopNotice("Reporte exportado exitosamente a CSV.", "success", 3000);
    });
  }
});
