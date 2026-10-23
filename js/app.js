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
  const btnSubmitRegistration = document.getElementById("btn-submit-registration");

  // Estado local del formulario
  let currentLockId = "lock-" + Date.now();
  let currentAvailableSlots = 90;

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

    // Verificar si ya venció el plazo de confirmación (25 de Noviembre de 2026 inclusive)
    const deadlineIso = (config.EVENT && config.EVENT.RSVP_DEADLINE_ISO) || "2026-11-25T23:59:59-05:00";
    const deadlineExceeded = Date.now() > new Date(deadlineIso).getTime();

    const deadlineNotice = document.getElementById("deadline-expired-notice");
    const fullNotice = document.getElementById("full-capacity-notice");

    if (deadlineExceeded) {
      if (mainRsvpBtn) mainRsvpBtn.style.display = "none";
      if (deadlineNotice) deadlineNotice.style.display = "block";
      if (fullNotice) fullNotice.style.display = "none";
      if (vacanciesCountEl) vacanciesCountEl.textContent = "Plazo Finalizado";
      if (vacanciesIndicatorDot) {
        vacanciesIndicatorDot.style.background = "#dc3545";
      }
      return;
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
      if (stats.available >= 1) {
        if (mainRsvpBtn) mainRsvpBtn.style.display = "inline-flex";
        if (fullNotice) fullNotice.style.display = "none";
        if (deadlineNotice) deadlineNotice.style.display = "none";
      } else {
        if (mainRsvpBtn) mainRsvpBtn.style.display = "none";
        if (fullNotice) fullNotice.style.display = "block";
        if (deadlineNotice) deadlineNotice.style.display = "none";
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
      // Validar fecha límite
      const deadlineIso = (config.EVENT && config.EVENT.RSVP_DEADLINE_ISO) || "2026-11-25T23:59:59-05:00";
      if (Date.now() > new Date(deadlineIso).getTime()) {
        window.showTopNotice("El plazo de confirmación de asistencia finalizó el 25 de Noviembre.", "warning", 5000);
        return;
      }

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

  function unlockStepEmail() {
    stepEmail.classList.remove("locked");
    inputEmail.removeAttribute("disabled");
  }

  function lockStepEmail() {
    stepEmail.classList.add("locked");
    inputEmail.setAttribute("disabled", "true");
    inputEmail.classList.remove("valid", "invalid");
    feedbackEmail.className = "form-feedback";
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
      btnSubmitRegistration.setAttribute("disabled", "true");
      return;
    }

    const domain = val.split("@")[1];
    if (personalDomains.includes(domain)) {
      inputEmail.classList.add("valid");
      inputEmail.classList.remove("invalid");
      feedbackEmail.className = "form-feedback";
      btnSubmitRegistration.removeAttribute("disabled");
    } else if (domain && domain.endsWith(".com")) {
      inputEmail.classList.add("invalid");
      feedbackEmail.className = "form-feedback feedback-warning active";
      feedbackEmail.textContent = "Usa tu correo personal para evitar restricciones de dominios corporativos.";
      btnSubmitRegistration.setAttribute("disabled", "true");
    } else {
      inputEmail.classList.add("invalid");
      feedbackEmail.className = "form-feedback feedback-error active";
      feedbackEmail.textContent = "Por favor ingresa un correo válido (Gmail, Hotmail, Yahoo, Outlook, iCloud).";
      btnSubmitRegistration.setAttribute("disabled", "true");
    }
  });

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

    // Transacción Atómica con Notificación Visual Superior
    btnSubmitRegistration.setAttribute("disabled", "true");
    const originalHtml = btnSubmitRegistration.innerHTML;

    btnSubmitRegistration.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:10px;vertical-align:middle;"></span> Guardando tu cupo en GitHub...`;
    window.showTopNotice("Confirmando tu asistencia y reservando tu puesto en GitHub...", "loading");

    try {
      // 1. INYECCIÓN ATÓMICA EN GITHUB Y VALIDACIÓN TRANSACCIONAL (Sin acompañantes desde la web pública)
      const result = await dbService.registerGuest(
        { name: leaderName, document: leaderDoc, email: leaderEmail }, 
        [], 
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
  // ==========================================
  // RENDERIZADO DEL PASE DIGITAL VIP Y SINCRONIZACIÓN EN TIEMPO REAL
  // ==========================================
  let activeRealtimeListener = null;

  async function renderVipPass(cookieData) {
    if (!vipPassSection) return;

    if (mainRsvpBtn) mainRsvpBtn.style.display = "none";
    const statusContainer = document.getElementById("vacancies-bar-container");
    if (statusContainer) statusContainer.style.display = "none";
    const deadlineBanner = document.getElementById("rsvp-deadline-banner");
    if (deadlineBanner) deadlineBanner.style.display = "none";
    const deadlineNotice = document.getElementById("deadline-expired-notice");
    if (deadlineNotice) deadlineNotice.style.display = "none";

    let checkedIn = false;
    let groupCompanions = cookieData.companions || [];

    try {
      const db = await dbService.fetchDatabase();
      const slotObj = (db.slots || []).find(s => s && s.guest && s.guest.code === cookieData.code);
      if (slotObj && slotObj.guest) {
        if (slotObj.guest.checked_in) {
          checkedIn = true;
        }
        // Buscar acompañantes asignados por el Admin en su mismo núcleo o grupo
        if (slotObj.guest.group_id) {
          const compSlots = db.slots.filter(s => s && s.guest && s.guest.group_id === slotObj.guest.group_id && s.guest.code !== slotObj.guest.code);
          if (compSlots.length > 0) {
            groupCompanions = compSlots.map(s => ({
              code: s.guest.code,
              name: s.guest.name,
              slot_number: s.slot,
              checked_in: s.guest.checked_in
            }));
          }
        }
      }
    } catch (e) {}

    vipPassSection.style.display = "block";
    
    if (checkedIn) {
      vipPassSection.innerHTML = `
        <div class="vip-pass-badge" style="background: linear-gradient(90deg, #198754, #20c997); color: #fff; box-shadow: 0 0 25px rgba(32, 201, 151, 0.6);">
          ✨ ACCESO AUTORIZADO ✨
        </div>
        <h2 class="vip-guest-name" style="font-size: 34px; color: #fff; text-shadow: 0 0 20px rgba(242, 73, 231, 0.7);">${escapeHtml(cookieData.name)}</h2>
        <div class="vip-slot-info" style="color: #2ecc71; font-weight: bold; font-size: 18px;">Puesto Oficial Asignado: #${cookieData.slot_number} de 90</div>
        
        <div class="checked-in-banner" style="margin-top: 25px; border: 2px solid #2ecc71; box-shadow: 0 0 40px rgba(40, 167, 69, 0.6); padding: 25px 20px; border-radius: 20px; background: linear-gradient(135deg, rgba(25, 135, 84, 0.35) 0%, rgba(32, 201, 151, 0.2) 100%); backdrop-filter: blur(8px);">
          <div style="font-size: 36px; margin-bottom: 8px;">👑 🎉 ✨</div>
          <h3 style="margin-bottom: 12px; font-size: 26px; font-family: var(--font-serif); color: #fff2b2; text-shadow: 0 0 15px rgba(243, 202, 101, 0.5);">
            ¡Bienvenid@ a la Gran Fiesta!
          </h3>
          <p style="font-size: 15px; font-weight: 500; color: #f7eafc; line-height: 1.5; max-width: 480px; margin: 0 auto;">
            Tu ingreso ha sido registrado y verificado por la recepción. Pasa adelante y disfruta de una noche mágica e inolvidable junto a Sara Sofía.
          </p>
        </div>

        ${groupCompanions && groupCompanions.length > 0 ? `
        <div style="background: rgba(255,255,255,0.06); padding: 16px; border-radius: 14px; margin-top: 25px; text-align: left; border: 1px solid rgba(242, 73, 231, 0.25);">
          <h4 style="color: var(--gold-light); margin-bottom: 8px; font-size: 13px;">👥 Tus Acompañantes en Mesa:</h4>
          <ul style="font-size: 13px; color: #ccc; padding-left: 20px; margin: 0; line-height: 1.6;">
            ${groupCompanions.map(c => `<li><strong>${escapeHtml(c.name)}</strong> (Puesto #${c.slot_number}) ${c.checked_in ? '<span style="color:#2ecc71; font-weight:bold;">✓ Ya Ingresó</span>' : '<span style="color:#aaa;">(Por ingresar)</span>'}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <div class="vip-actions" style="margin-top: 25px;">
          <a href="${config.EVENT.GOOGLE_CALENDAR_URL}" target="_blank" class="btn-calendar-pass">📅 Agendar en Google Calendar</a>
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
        <p style="font-size: 12px; color: var(--gold-light); margin-bottom: 20px;">
          Presenta este código QR en la recepción el 20 de Diciembre de 2026
        </p>
        
        ${groupCompanions && groupCompanions.length > 0 ? `
        <div style="background: rgba(255,255,255,0.06); padding: 16px; border-radius: 14px; margin-bottom: 20px; text-align: left; border: 1px solid rgba(242, 73, 231, 0.25);">
          <h4 style="color: var(--gold-light); margin-bottom: 8px; font-size: 13px;">👥 Acompañantes Asignados por el Administrador:</h4>
          <ul style="font-size: 12.5px; color: #ccc; padding-left: 20px; margin: 0; line-height: 1.6;">
            ${groupCompanions.map(c => `<li><strong>${escapeHtml(c.name)}</strong> (Puesto #${c.slot_number} - Código: <code>${escapeHtml(c.code)}</code>)</li>`).join('')}
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

      // Iniciar la escucha en tiempo real multicapa (SSE, WebSockets, Polling, Focus)
      setupRealtimeCheckInListener(cookieData.code, cookieData);
    }
  }

  // ==========================================
  // MOTOR DE SINCRONIZACIÓN EN TIEMPO REAL (AL ESCANEAR QR)
  // Conecta el celular del invitado con la recepción para actualizar en vivo
  // ==========================================
  function setupRealtimeCheckInListener(guestCode, cookieData) {
    if (activeRealtimeListener) {
      activeRealtimeListener.cleanup();
      activeRealtimeListener = null;
    }

    const cleanCode = (guestCode || "").trim().toUpperCase();
    let isTriggered = false;

    function onCheckInConfirmed(sourceName) {
      if (isTriggered) return;
      isTriggered = true;
      console.log(`[Realtime Sync] ¡Ingreso confirmado vía ${sourceName}! Actualizando pantalla...`);
      if (activeRealtimeListener) {
        activeRealtimeListener.cleanup();
        activeRealtimeListener = null;
      }
      triggerGuestLiveCelebration(cookieData);
    }

    // 1. BroadcastChannel (Para pestañas / ventanas en el mismo navegador)
    let bc = null;
    try {
      if (window.BroadcastChannel) {
        bc = new BroadcastChannel("sara15_realtime_channel");
        bc.onmessage = (e) => {
          if (e.data && e.data.type === "CHECKED_IN" && e.data.code === cleanCode) {
            onCheckInConfirmed("BroadcastChannel");
          } else if (e.data && e.data.type === "COMPANIONS_UPDATED" && e.data.leaderCode === cleanCode) {
            renderVipPass(cookieData);
          }
        };
      }
    } catch (e) {}

    // 2. Storage Event (Para sincronizar ventanas/pestañas en el mismo dispositivo)
    const onStorage = (e) => {
      if (e.key === "sara15_last_checkin_signal" && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data && data.code === cleanCode) {
            onCheckInConfirmed("StorageEvent");
          }
        } catch (err) {}
      }
    };
    window.addEventListener("storage", onStorage);

    // 3. NTFY.sh Realtime Server-Sent Events (SSE) Cross-Device
    const prefix = (config.REALTIME && config.REALTIME.NTFY_PREFIX) || "sara15_checkin_";
    let eventSource = null;
    try {
      if (window.EventSource) {
        eventSource = new EventSource(`https://ntfy.sh/${prefix}${cleanCode}/sse`);
        eventSource.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data && data.code === cleanCode) {
              onCheckInConfirmed("NTFY-SSE");
            }
          } catch (err) {
            if (evt.data && evt.data.includes("CHECKED_IN")) {
              onCheckInConfirmed("NTFY-SSE-Raw");
            }
          }
        };
      }
    } catch (e) {}

    // 4. NTFY.sh WebSocket Fallback
    let ws = null;
    try {
      ws = new WebSocket(`wss://ntfy.sh/${prefix}${cleanCode}/ws`);
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data && data.code === cleanCode) {
            onCheckInConfirmed("NTFY-WebSocket");
          }
        } catch (err) {
          if (evt.data && evt.data.includes("CHECKED_IN")) {
            onCheckInConfirmed("NTFY-WS-Raw");
          }
        }
      };
    } catch (e) {}

    // 5. Polling de Respaldo de Alta Frecuencia (cada 2.5s)
    const pollInterval = setInterval(async () => {
      try {
        const db = await dbService.fetchDatabase(true);
        const slot = (db.slots || []).find(s => s && s.guest && s.guest.code === cleanCode);
        if (slot && slot.guest && slot.guest.checked_in) {
          onCheckInConfirmed("Fast-Polling");
        }
      } catch (e) {}
    }, 2500);

    // 6. Al regresar a la página (por si mostró foto del QR o abrió otra app)
    const onVisibilityOrFocus = async () => {
      if (document.visibilityState === "visible") {
        try {
          const db = await dbService.fetchDatabase(true);
          const slot = (db.slots || []).find(s => s && s.guest && s.guest.code === cleanCode);
          if (slot && slot.guest && slot.guest.checked_in) {
            onCheckInConfirmed("VisibilityChange");
          }
        } catch (e) {}
      }
    };
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    activeRealtimeListener = {
      cleanup: () => {
        if (bc) { try { bc.close(); } catch (e) {} }
        window.removeEventListener("storage", onStorage);
        if (eventSource) { try { eventSource.close(); } catch (e) {} }
        if (ws) { try { ws.close(); } catch (e) {} }
        clearInterval(pollInterval);
        document.removeEventListener("visibilitychange", onVisibilityOrFocus);
        window.removeEventListener("focus", onVisibilityOrFocus);
      }
    };
  }

  // ==========================================
  // CELEBRACIÓN Y TRANSFORMACIÓN DINÁMICA DE ENTRADA
  // ==========================================
  function triggerGuestLiveCelebration(cookieData) {
    if (!vipPassSection) return;

    // Actualizar cookie local de asistencia a checked_in
    cookieData.checked_in = true;
    dbService.setAttendanceCookie(cookieData);

    // Vibración háptica en smartphones
    if (navigator.vibrate) {
      try { navigator.vibrate([150, 80, 150, 80, 300]); } catch (e) {}
    }

    // Animación suave de transición
    vipPassSection.style.transition = "all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    vipPassSection.style.transform = "scale(0.95)";
    vipPassSection.style.opacity = "0.7";

    setTimeout(() => {
      renderVipPass(cookieData);
      vipPassSection.style.transform = "scale(1)";
      vipPassSection.style.opacity = "1";

      // Doble ráfaga de confeti estelar
      if (window.triggerGuestConfetti) {
        window.triggerGuestConfetti();
        setTimeout(() => window.triggerGuestConfetti(), 1400);
      }
    }, 450);
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
