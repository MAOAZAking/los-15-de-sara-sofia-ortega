/**
 * ==========================================================================
 * APP.JS - CONTROLADOR PRINCIPAL DE LA INVITACIÓN
 * Quinceañera: Sara Sofía Ortega Ayala
 * Fecha: 20 de Diciembre de 2026
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
  const config = window.APP_CONFIG;
  const dbService = window.dbService;

  // Elementos DOM
  const vacanciesCountEl = document.getElementById("vacancies-count");
  const vacanciesIndicatorDot = document.getElementById("vacancies-indicator-dot");
  const rsvpActionContainer = document.getElementById("rsvp-action-container");
  const vipPassSection = document.getElementById("vip-pass-section");
  const mainRsvpBtn = document.getElementById("btn-main-rsvp");
  
  // Modal de Registro
  const rsvpModal = document.getElementById("rsvp-modal");
  const closeModalBtn = document.getElementById("modal-close-btn");
  const rsvpForm = document.getElementById("rsvp-registration-form");
  const formVacanciesText = document.getElementById("form-vacancies-text");

  // Pasos Progresivos del Formulario
  const stepName = document.getElementById("step-name");
  const stepDoc = document.getElementById("step-doc");
  const stepEmail = document.getElementById("step-email");
  const inputName = document.getElementById("input-name");
  const inputDoc = document.getElementById("input-doc");
  const inputEmail = document.getElementById("input-email");

  // Feedback y Avisos
  const feedbackName = document.getElementById("feedback-name");
  const feedbackDoc = document.getElementById("feedback-doc");
  const feedbackEmail = document.getElementById("feedback-email");
  const formerGroupBanner = document.getElementById("former-group-banner");
  const formerGroupText = document.getElementById("former-group-text");
  const btnRestoreGroup = document.getElementById("btn-restore-group");

  // Acompañantes
  const companionsSection = document.getElementById("companions-section");
  const companionsList = document.getElementById("companions-list");
  const btnAddCompanion = document.getElementById("btn-add-companion");
  const btnSubmitRegistration = document.getElementById("btn-submit-registration");

  // Estado local del formulario
  let currentLockId = "lock-" + Date.now();
  let companionCount = 0;
  let currentAvailableSlots = 90;
  let previousRegistrationFound = null;

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

  // 1. Inicializar Canvas de Estrellas y Cuenta Regresiva
  initStarCanvas();
  initCountdown();

  // 2. Verificar Cookie de Asistencia Existente (Persistente hasta 21 Dic 2026)
  const existingCookie = dbService.getAttendanceCookie();
  if (existingCookie && existingCookie.code) {
    await renderVipPass(existingCookie);
    return; // Ya registrado en este dispositivo
  }

  // 3. Consultar base de datos y vacantes en tiempo real
  await checkVacanciesAndSetupRSVP();

  // ==========================================================================
  // RELOJ CONTADOR REGRESIVO ATÓMICO (20 DIC 2026, 5:00 PM HORA COLOMBIA)
  // ==========================================================================
  function initCountdown() {
    const daysEl = document.getElementById("count-days");
    const hoursEl = document.getElementById("count-hours");
    const minsEl = document.getElementById("count-mins");
    const secsEl = document.getElementById("count-secs");
    if (!daysEl || !hoursEl || !minsEl || !secsEl) return;

    // 20 de Diciembre de 2026, 5:00 PM hora Colombia (UTC-5)
    const targetDate = new Date("2026-12-20T17:00:00-05:00").getTime();

    function update() {
      const now = Date.now();
      const diff = targetDate - now;

      if (diff <= 0) {
        daysEl.textContent = "00";
        hoursEl.textContent = "00";
        minsEl.textContent = "00";
        secsEl.textContent = "00";
        const container = document.querySelector(".countdown-container");
        if (container) {
          container.innerHTML = `<div style="color:var(--primary-light); font-size: 22px; font-weight: bold; text-align: center; padding: 15px;">🎉 ¡Llegó el gran día de los 15 de Sara Sofía! 🎉</div>`;
        }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      daysEl.textContent = String(days).padStart(2, "0");
      hoursEl.textContent = String(hours).padStart(2, "0");
      minsEl.textContent = String(mins).padStart(2, "0");
      secsEl.textContent = String(secs).padStart(2, "0");
    }

    // Ejecución inmediata para evitar el parpadeo 00
    update();
    setInterval(update, 1000);
  }

  // ==========================================================================
  // CONSULTA DE VACANTES Y RENDERIZADO EN TIEMPO REAL
  // ==========================================================================
  async function checkVacanciesAndSetupRSVP() {
    if (vacanciesCountEl && vacanciesCountEl.textContent === "Consultando...") {
      vacanciesCountEl.innerHTML = `<span class="spinner" style="width:12px;height:12px;display:inline-block;border-width:2px;margin-right:6px;"></span>Consultando...`;
    }

    try {
      const stats = await dbService.getVacanciesCount();
      currentAvailableSlots = stats.available;

      // Actualizar contador visual
      if (vacanciesCountEl) {
        vacanciesCountEl.textContent = `${stats.available} de 90`;
      }

      if (vacanciesIndicatorDot) {
        vacanciesIndicatorDot.className = "vacancy-dot";
        if (stats.available === 0) {
          vacanciesIndicatorDot.style.background = "#dc3545"; // Rojo: Agotado
        } else if (stats.available <= 15) {
          vacanciesIndicatorDot.style.background = "#f39c12"; // Naranja: Pocos cupos
        } else {
          vacanciesIndicatorDot.style.background = "#28a745"; // Verde: Disponible
        }
      }

      // Si hay al menos 1 vacante, muestra el botón. Si 0, muestra aviso de aforo completo
      const fullNotice = document.getElementById("full-capacity-notice");
      if (stats.available >= 1) {
        if (mainRsvpBtn) mainRsvpBtn.style.display = "inline-flex";
        if (fullNotice) fullNotice.style.display = "none";
      } else {
        if (mainRsvpBtn) mainRsvpBtn.style.display = "none";
        if (fullNotice) fullNotice.style.display = "block";
      }
    } catch (err) {
      console.warn("Error al consultar vacantes:", err);
      if (vacanciesCountEl) vacanciesCountEl.textContent = "Disponibles";
      if (mainRsvpBtn) mainRsvpBtn.style.display = "inline-flex";
    }
  }

  // ==========================================================================
  // APERTURA DE MODAL Y BLOQUEO TEMPORAL
  // ==========================================================================
  if (mainRsvpBtn) {
    mainRsvpBtn.addEventListener("click", async () => {
      window.showTopNotice("Verificando disponibilidad de cupos en tiempo real...", "loading");
      
      const stats = await dbService.getVacanciesCount();
      currentAvailableSlots = stats.available;
      window.hideTopNotice();

      if (currentAvailableSlots < 1) {
        window.showTopNotice("Lo sentimos, los 90 cupos acaban de completarse.", "warning", 4500);
        await checkVacanciesAndSetupRSVP();
        return;
      }

      // Bloquear cupo temporalmente para este usuario
      currentLockId = "lock-" + Date.now();
      await dbService.lockSlotTemporarily(currentLockId);

      // Mostrar modal
      formVacanciesText.textContent = `Cupos disponibles en este momento: ${currentAvailableSlots} de 90`;
      rsvpModal.classList.add("active");
      inputName.focus();
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", async () => {
      rsvpModal.classList.remove("active");
      await dbService.releaseTemporaryLock(currentLockId);
    });
  }

  // Cerrar al hacer clic fuera del modal
  rsvpModal.addEventListener("click", async (e) => {
    if (e.target === rsvpModal) {
      rsvpModal.classList.remove("active");
      await dbService.releaseTemporaryLock(currentLockId);
    }
  });

  // ==========================================================================
  // DESBLOQUEO PROGRESIVO DE CAMPOS DEL FORMULARIO
  // ==========================================================================

  // Campo 1: Nombre completo
  inputName.addEventListener("input", () => {
    const val = inputName.value;
    const validLettersOnly = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(val) && val.trim().length >= 3;

    if (validLettersOnly) {
      inputName.classList.add("valid");
      inputName.classList.remove("invalid");
      feedbackName.className = "form-feedback";
      unlockStepDoc();
    } else {
      inputName.classList.remove("valid");
      if (val.length > 0 && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(val)) {
        inputName.classList.add("invalid");
        feedbackName.className = "form-feedback feedback-error active";
        feedbackName.textContent = "El nombre solo puede contener letras y espacios.";
      } else {
        feedbackName.className = "form-feedback";
      }
      lockStepDoc();
      lockStepEmail();
    }
  });

  async function unlockStepDoc() {
    if (stepDoc.classList.contains("locked")) {
      stepDoc.classList.remove("locked");
      inputDoc.removeAttribute("disabled");
      
      try {
        const stats = await dbService.getVacanciesCount();
        currentAvailableSlots = stats.available;
        formVacanciesText.textContent = `Vacantes confirmadas en la base de datos: ${currentAvailableSlots} de 90`;
        if (currentAvailableSlots < 1) {
          window.showTopNotice("Aviso: Ya no quedan vacantes libres.", "warning", 4000);
        }
      } catch (e) {}
    }
  }

  function lockStepDoc() {
    stepDoc.classList.add("locked");
    inputDoc.setAttribute("disabled", "true");
    inputDoc.classList.remove("valid", "invalid");
    feedbackDoc.className = "form-feedback";
  }

  // Campo 2: Documento
  inputDoc.addEventListener("input", async () => {
    const val = inputDoc.value.trim();
    const validNumbersOnly = /^\d{5,15}$/.test(val);

    if (validNumbersOnly) {
      inputDoc.classList.add("valid");
      inputDoc.classList.remove("invalid");
      feedbackDoc.className = "form-feedback";

      checkFormerLeader(val);
      unlockStepEmail();
    } else {
      inputDoc.classList.remove("valid");
      if (val.length > 0 && !/^\d+$/.test(val)) {
        inputDoc.classList.add("invalid");
        feedbackDoc.className = "form-feedback feedback-error active";
        feedbackDoc.textContent = "El número de documento solo debe contener dígitos numéricos.";
      } else {
        feedbackDoc.className = "form-feedback";
      }
      lockStepEmail();
    }
  });

  async function checkFormerLeader(doc) {
    try {
      const prev = await dbService.checkPreviousRegistration(doc);
      if (prev && prev.companions && prev.companions.length > 0) {
        previousRegistrationFound = prev;
        formerGroupBanner.classList.add("active");
        
        if (currentAvailableSlots >= prev.totalGroupSize) {
          formerGroupText.innerHTML = `Detectamos que en tu registro anterior tenías <strong>${prev.companions.length}</strong> acompañante(s) registrado(s). ¿Deseas volver a agregarlos a todos?`;
          btnRestoreGroup.textContent = `Volver a agregar a mis ${prev.companions.length} acompañantes`;
        } else {
          formerGroupText.innerHTML = `Tenías ${prev.companions.length} acompañantes antes, pero solo quedan <strong>${Math.max(0, currentAvailableSlots - 1)}</strong> vacantes adicionales disponibles.`;
          btnRestoreGroup.textContent = `Agregar acompañantes disponibles`;
        }
      } else {
        formerGroupBanner.classList.remove("active");
      }
    } catch (e) {}
  }

  if (btnRestoreGroup) {
    btnRestoreGroup.addEventListener("click", () => {
      if (!previousRegistrationFound) return;
      const allowedCount = Math.min(previousRegistrationFound.companions.length, Math.max(0, currentAvailableSlots - 1));
      companionsList.innerHTML = "";
      companionCount = 0;

      for (let i = 0; i < allowedCount; i++) {
        const c = previousRegistrationFound.companions[i];
        addCompanionCard(c.name, c.email);
      }
      companionsSection.classList.add("active");
      formerGroupBanner.classList.remove("active");
      window.showTopNotice("Acompañantes cargados. Por favor ingresa el documento de cada uno.", "info", 3500);
      updateCompanionButtonVisibility();
    });
  }

  function unlockStepEmail() {
    stepEmail.classList.remove("locked");
    inputEmail.removeAttribute("disabled");
  }

  function lockStepEmail() {
    stepEmail.classList.add("locked");
    inputEmail.setAttribute("disabled", "true");
    inputEmail.classList.remove("valid", "invalid");
    feedbackEmail.className = "form-feedback";
    companionsSection.classList.remove("active");
    btnSubmitRegistration.setAttribute("disabled", "true");
  }

  // Campo 3: Correo Electrónico
  const personalDomains = [
    "gmail.com", "hotmail.com", "yahoo.com", "yahoo.es",
    "outlook.com", "outlook.es", "icloud.com", "me.com", "mac.com", "live.com"
  ];

  inputEmail.addEventListener("blur", () => {
    if (!inputEmail.value.trim() && !stepEmail.classList.contains("locked")) {
      feedbackEmail.className = "form-feedback feedback-warning active";
      feedbackEmail.textContent = "Si es un menor y no tiene correo, puede poner el correo del tutor legal, pero se necesita poner algún correo.";
    }
  });

  inputEmail.addEventListener("input", () => {
    const val = inputEmail.value.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(val)) {
      inputEmail.classList.remove("valid");
      feedbackEmail.className = "form-feedback";
      updateCompanionButtonVisibility();
      return;
    }

    const domain = val.split("@")[1];
    if (personalDomains.includes(domain)) {
      inputEmail.classList.add("valid");
      inputEmail.classList.remove("invalid");
      feedbackEmail.className = "form-feedback";
      onLeaderDataComplete();
    } else if (domain && domain.endsWith(".com")) {
      inputEmail.classList.add("invalid");
      feedbackEmail.className = "form-feedback feedback-warning active";
      feedbackEmail.textContent = "Usa tu correo personal para evitar restricciones de dominios corporativos.";
      updateCompanionButtonVisibility();
    } else {
      inputEmail.classList.add("invalid");
      feedbackEmail.className = "form-feedback feedback-error active";
      feedbackEmail.textContent = "Por favor ingresa un correo válido (Gmail, Hotmail, Yahoo, Outlook, iCloud).";
      updateCompanionButtonVisibility();
    }
  });

  function onLeaderDataComplete() {
    companionsSection.classList.add("active");
    btnSubmitRegistration.removeAttribute("disabled");
    updateCompanionButtonVisibility();
  }

  // ==========================================
  // GESTIÓN DE ACOMPAÑANTES
  // ==========================================

  function updateCompanionButtonVisibility() {
    const occupiedByThisForm = 1 + companionCount;
    const canAddMore = (currentAvailableSlots - occupiedByThisForm) > 0;

    if (canAddMore) {
      btnAddCompanion.style.display = "flex";
      btnAddCompanion.removeAttribute("disabled");
    } else {
      btnAddCompanion.style.display = "none";
    }
  }

  btnAddCompanion.addEventListener("click", async () => {
    window.showTopNotice("Verificando cupos libres...", "loading");
    const stats = await dbService.getVacanciesCount();
    currentAvailableSlots = stats.available;
    window.hideTopNotice();

    const occupiedByThisForm = 1 + companionCount;
    if (currentAvailableSlots <= occupiedByThisForm) {
      window.showTopNotice("No hay más vacantes libres para agregar otro acompañante.", "warning", 3500);
      updateCompanionButtonVisibility();
      return;
    }

    await dbService.lockSlotTemporarily(`${currentLockId}-comp-${companionCount + 1}`);
    addCompanionCard();
  });

  function addCompanionCard(initialName = "", initialEmail = "") {
    companionCount++;
    const compIndex = companionCount;

    const card = document.createElement("div");
    card.className = "companion-card";
    card.id = `companion-card-${compIndex}`;

    card.innerHTML = `
      <div class="companion-card-header">
        <span class="companion-badge">Acompañante #${compIndex}</span>
        <button type="button" class="btn-remove-companion" data-index="${compIndex}">✕ Quitar</button>
      </div>
      <div class="companion-field">
        <label class="form-label">Nombre Completo del Acompañante</label>
        <input type="text" class="companion-input comp-name" placeholder="Solo letras y espacios" value="${escapeHtml(initialName)}" required>
      </div>
      <div class="companion-field">
        <label class="form-label">Número de Documento</label>
        <input type="text" inputmode="numeric" class="companion-input comp-doc" placeholder="Solo dígitos numéricos" required>
      </div>
      <div class="companion-field">
        <label class="form-label">Correo Electrónico (o del tutor si es menor)</label>
        <input type="email" class="companion-input comp-email" placeholder="ejemplo@gmail.com" value="${escapeHtml(initialEmail)}">
      </div>
      <div class="comp-feedback form-feedback"></div>
    `;

    companionsList.appendChild(card);

    const removeBtn = card.querySelector(".btn-remove-companion");
    removeBtn.addEventListener("click", () => {
      card.remove();
      companionCount--;
      updateCompanionButtonVisibility();
    });

    updateCompanionButtonVisibility();
  }

  // ==========================================
  // ENVÍO FINAL Y REGISTRO ATÓMICO EN GITHUB
  // ==========================================

  rsvpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const leaderName = inputName.value.trim();
    const leaderDoc = inputDoc.value.trim();
    const leaderEmail = inputEmail.value.trim();

    if (!leaderName || !leaderDoc || !leaderEmail) {
      window.showTopNotice("Por favor completa todos tus datos.", "error", 3500);
      return;
    }

    const companionCards = companionsList.querySelectorAll(".companion-card");
    const companions = [];

    for (const card of companionCards) {
      const cName = card.querySelector(".comp-name").value.trim();
      const cDoc = card.querySelector(".comp-doc").value.trim();
      const cEmail = card.querySelector(".comp-email").value.trim() || leaderEmail;
      const feedback = card.querySelector(".comp-feedback");

      if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]{3,60}$/.test(cName)) {
        feedback.className = "comp-feedback form-feedback feedback-error active";
        feedback.textContent = "El nombre del acompañante solo debe tener letras.";
        return;
      }

      if (!/^\d{5,15}$/.test(cDoc)) {
        feedback.className = "comp-feedback form-feedback feedback-error active";
        feedback.textContent = "El documento del acompañante solo debe contener números.";
        return;
      }

      companions.push({
        name: cName,
        document: cDoc,
        email: cEmail
      });
    }

    // Transacción Atómica con Notificación Visual Superior
    btnSubmitRegistration.setAttribute("disabled", "true");
    const originalHtml = btnSubmitRegistration.innerHTML;

    btnSubmitRegistration.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:10px;vertical-align:middle;"></span> Generando tu vacante en GitHub...`;
    window.showTopNotice("Generando tu vacante y guardando en GitHub...", "loading");

    try {
      // 1. INYECCIÓN ATÓMICA EN GITHUB Y VALIDACIÓN TRANSACCIONAL
      const result = await dbService.registerGuest(
        { name: leaderName, document: leaderDoc, email: leaderEmail }, 
        companions, 
        currentLockId
      );

      // 2. ÉXITO VISUAL: Transformación del botón
      btnSubmitRegistration.style.background = "#28a745";
      btnSubmitRegistration.style.boxShadow = "0 8px 30px rgba(40, 167, 69, 0.4)";
      btnSubmitRegistration.innerHTML = `¡Cupo Asegurado en GitHub! 🔒`;

      window.showTopNotice("¡Asistencia confirmada y registrada en la base de datos de GitHub!", "success", 5000);

      // Requisito especial: Abrir Google Calendar
      try {
        window.open(config.EVENT.GOOGLE_CALENDAR_URL, "_blank");
      } catch (popErr) {}

      // 3. Renderizar Pase VIP y cerrar formulario
      setTimeout(async () => {
        try {
          await renderVipPass(result.cookieData);
          rsvpModal.classList.remove("active");
          triggerGuestConfetti();
        } catch (renderErr) {
          console.error("Error al renderizar el pase VIP:", renderErr);
        } finally {
          btnSubmitRegistration.removeAttribute("disabled");
          btnSubmitRegistration.innerHTML = originalHtml;
          btnSubmitRegistration.style.background = "";
          btnSubmitRegistration.style.boxShadow = "";
        }
      }, 1200);

    } catch (err) {
      console.error("Fallo al registrar asistencia:", err);
      const friendlyMessage = err.message || "Error al conectar con la base de datos de GitHub. Intenta nuevamente.";
      window.showTopNotice(friendlyMessage, "error", 6000);

      btnSubmitRegistration.removeAttribute("disabled");
      btnSubmitRegistration.innerHTML = originalHtml;
      btnSubmitRegistration.style.background = "";
      btnSubmitRegistration.style.boxShadow = "";
    }
  });

  // ==========================================
  // RENDERIZADO DEL PASE DIGITAL VIP
  // ==========================================
  async function renderVipPass(cookieData) {
    if (!vipPassSection) return;

    if (mainRsvpBtn) mainRsvpBtn.style.display = "none";
    const statusContainer = document.getElementById("vacancies-bar-container");
    if (statusContainer) statusContainer.style.display = "none";

    let checkedIn = false;
    try {
      const db = await dbService.fetchDatabase();
      const slotObj = db.slots.find(s => s && s.guest && s.guest.code === cookieData.code);
      if (slotObj && slotObj.guest && slotObj.guest.checked_in) {
        checkedIn = true;
      }
    } catch (e) {}

    vipPassSection.style.display = "block";
    
    if (checkedIn) {
      vipPassSection.innerHTML = `
        <div class="vip-pass-badge" style="background: linear-gradient(90deg, #198754, #20c997); color: #fff;">
          ACCESO AUTORIZADO
        </div>
        <h2 class="vip-guest-name">${escapeHtml(cookieData.name)}</h2>
        <div class="vip-slot-info" style="color: #2ecc71;">Puesto Asignado: #${cookieData.slot_number} de 90</div>
        
        <div class="checked-in-banner" style="margin-top: 30px; border: 2px solid #2ecc71; box-shadow: 0 0 30px rgba(40, 167, 69, 0.4);">
          <h3 style="margin-bottom:10px; font-size: 22px;">✨ ¡Bienvenid@ a la Fiesta! ✨</h3>
          <p style="font-size: 14px; font-weight: normal;">Tu acceso ha sido verificado. Disfruta de una noche inolvidable celebrando los 15 Años de Sara Sofía.</p>
        </div>
      `;
      triggerGuestConfetti();

    } else {
      vipPassSection.innerHTML = `
        <div class="vip-pass-badge">Pase Oficial de Invitado VIP</div>
        <h2 class="vip-guest-name">${escapeHtml(cookieData.name)}</h2>
        <div class="vip-slot-info">Puesto Asignado: #${cookieData.slot_number} de 90</div>
        
        <div class="qr-code-wrapper" id="pass-qrcode-container"></div>
        <div class="vip-pass-code">${escapeHtml(cookieData.code)}</div>
        <p style="font-size: 11px; color: #aaa; margin-bottom: 20px;">Presenta este código QR en la entrada el 20 de Diciembre de 2026</p>
        
        ${cookieData.companions && cookieData.companions.length > 0 ? `
        <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 20px; text-align: left;">
          <h4 style="color: var(--gold-light); margin-bottom: 8px; font-size: 13px;">👥 Tus Acompañantes:</h4>
          <ul style="font-size: 12px; color: #ccc; padding-left: 20px; margin: 0;">
            ${cookieData.companions.map(c => `<li><strong>${escapeHtml(c.name)}</strong> (Puesto #${c.slot_number} - Código: ${escapeHtml(c.code)})</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        <div class="vip-actions">
          <a href="${config.EVENT.GOOGLE_CALENDAR_URL}" target="_blank" class="btn-calendar-pass">📅 Agendar en Google Calendar</a>
          <button id="btn-cancel-my-pass" class="btn-cancel-pass">❌ Cancelar Asistencia</button>
        </div>
      `;

      // Renderizar código QR
      setTimeout(() => {
        const qrContainer = document.getElementById("pass-qrcode-container");
        if (qrContainer && window.QRCode) {
          qrContainer.innerHTML = "";
          new QRCode(qrContainer, {
            text: cookieData.code,
            width: 180,
            height: 180,
            colorDark: "#180424",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
          });
        }
      }, 80);

      // Botón de cancelación
      setTimeout(() => {
        const cancelPassBtn = document.getElementById("btn-cancel-my-pass");
        if (cancelPassBtn) {
          cancelPassBtn.addEventListener("click", () => {
            window.location.href = `cancel.html?code=${encodeURIComponent(cookieData.code)}`;
          });
        }
      }, 100);
    }
  }

  // ==========================================
  // CONFETI Y CELEBRACIÓN VISUAL
  // ==========================================
  window.triggerGuestConfetti = function () {
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "99999";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ["#F249E7", "#2ecc71", "#e5c378", "#ffffff", "#ff85ec"];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2 - 40,
        vx: (Math.random() - 0.5) * 22,
        vy: (Math.random() - 1) * 22,
        size: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.floor(Math.random() * 10) - 10,
        tiltAngleInc: (Math.random() * 0.07) + 0.05,
        tiltAngle: 0
      });
    }

    let animationId;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.tiltAngle += p.tiltAngleInc;
        p.y += (Math.cos(p.tiltAngle) + 1 + p.size / 2) / 2;
        p.x += Math.sin(p.tiltAngle) * 2 + p.vx;
        p.vy += 0.4;
        p.y += p.vy;

        ctx.beginPath();
        ctx.lineWidth = p.size;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.size, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.size);
        ctx.stroke();
      });
      animationId = requestAnimationFrame(render);
    }
    render();

    setTimeout(() => {
      cancelAnimationFrame(animationId);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }, 4500);
  };
  window.triggerConfettiExplosion = window.triggerGuestConfetti;

  // ==========================================
  // CANVAS DE ESTRELLAS MÁGICAS INTERACTIVAS
  // ==========================================
  function initStarCanvas() {
    const canvas = document.getElementById("stars-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    
    window.addEventListener("resize", () => { 
      width = canvas.width = window.innerWidth; 
      height = canvas.height = window.innerHeight; 
    });

    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      baseRadius: Math.random() * 1.5 + 0.5,
      alpha: Math.random(),
      speed: Math.random() * 0.02 + 0.005,
      color: Math.random() > 0.3 ? "242, 73, 231" : "229, 195, 120"
    }));

    function animate() {
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        s.alpha += s.speed;
        if (s.alpha > 1 || s.alpha < 0) s.speed = -s.speed;
        
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color}, ${Math.abs(s.alpha)})`;
        ctx.shadowBlur = 5;
        ctx.shadowColor = `rgba(${s.color}, 0.8)`;
        ctx.fill();
      }
      requestAnimationFrame(animate);
    }
    animate();
  }
});
