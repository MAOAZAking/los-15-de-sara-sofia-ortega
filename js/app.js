/**
 * ==========================================================================
 * APP.JS - CONTROLADOR PRINCIPAL DE LA INVITACIÓN
 * Quinceañera: Sara Sofía Ortega Ayala
 * Fecha: 20 de Diciembre de 2026
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const head = document.head;
  const lightThemeLink = document.createElement("link");
  lightThemeLink.rel = "stylesheet";
  lightThemeLink.href = "css/main-light.css";

  // Check persistance
  if (localStorage.getItem("sara15_theme") === "light") {
    head.appendChild(lightThemeLink);
    themeToggleBtn.innerHTML = "☀️";
    themeToggleBtn.style.background = "rgba(255, 255, 255, 0.85)";
  }

  themeToggleBtn.addEventListener("click", () => {
    themeToggleBtn.style.transform = "rotate(360deg) scale(0.8)";
    
    setTimeout(() => {
      if (localStorage.getItem("sara15_theme") === "light") {
        head.removeChild(lightThemeLink);
        localStorage.setItem("sara15_theme", "dark");
        themeToggleBtn.innerHTML = "🌙";
        themeToggleBtn.style.background = "rgba(24, 6, 36, 0.85)";
      } else {
        head.appendChild(lightThemeLink);
        localStorage.setItem("sara15_theme", "light");
        themeToggleBtn.innerHTML = "☀️";
        themeToggleBtn.style.background = "rgba(255, 255, 255, 0.85)";
      }
      themeToggleBtn.style.transform = "rotate(0deg) scale(1)";
    }, 200);
  });
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
  let companionDataList = [];
  let currentAvailableSlots = 0;
  let previousRegistrationFound = null;

  // 1. Inicializar Canvas de Estrellas y Música
  initStarCanvas();
  initMusicPlayer();
  initCountdown();

  // 2. Verificar Cookie de Asistencia Existente (Persistente hasta 21 Dic 2026)
  const existingCookie = dbService.getAttendanceCookie();
  if (existingCookie && existingCookie.code) {
    await renderVipPass(existingCookie);
    return; // Ya registrado en este dispositivo
  }

  // 3. Si no hay cookie, consultar base de datos y vacantes ANTES de mostrar botón
  await checkVacanciesAndSetupRSVP();

  // ==========================================================================
  // CONSULTA DE VACANTES Y RENDERIZADO INICIAL
  // ==========================================================================

  async function checkVacanciesAndSetupRSVP() {
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
          vacanciesIndicatorDot.classList.add("empty");
        } else if (stats.available < 15) {
          vacanciesIndicatorDot.classList.add("low");
        }
      }

      // Requisito estricto: Si hay al menos 1 vacante, muestra el botón.
      // Si no hay vacantes (0), muestra aviso de aforo completo sin el botón.
      if (stats.available >= 1) {
        if (mainRsvpBtn) {
          mainRsvpBtn.style.display = "inline-flex";
        }
        const fullNotice = document.getElementById("full-capacity-notice");
        if (fullNotice) fullNotice.style.display = "none";
      } else {
        if (mainRsvpBtn) {
          mainRsvpBtn.style.display = "none";
        }
        const fullNotice = document.getElementById("full-capacity-notice");
        if (fullNotice) fullNotice.style.display = "block";
      }
    } catch (err) {
      console.error("Error al consultar vacantes:", err);
      // Por tolerancia mostramos disponible
      if (mainRsvpBtn) mainRsvpBtn.style.display = "inline-flex";
    }
  }

  // ==========================================================================
  // APERTURA DE MODAL Y BLOQUEO TEMPORAL
  // ==========================================================================

  if (mainRsvpBtn) {
    mainRsvpBtn.addEventListener("click", async () => {
      // Re-verificar vacantes frescas antes de abrir
      const stats = await dbService.getVacanciesCount();
      currentAvailableSlots = stats.available;
      if (currentAvailableSlots < 1) {
        showToast("Lo sentimos, los 90 cupos acaban de completarse.", "error");
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

  // Campo 1: Nombre completo (Solo letras y espacios)
  inputName.addEventListener("input", () => {
    const val = inputName.value;
    // Solo letras, acentos y espacios
    const validLettersOnly = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(val) && val.trim().length >= 3;

    if (validLettersOnly) {
      inputName.classList.add("valid");
      inputName.classList.remove("invalid");
      feedbackName.className = "form-feedback";
      
      // DESBLOQUEAR CAMPO 2: Documento
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

  // Desbloqueo de Documento y CONSULTA DE VACANTES
  async function unlockStepDoc() {
    if (stepDoc.classList.contains("locked")) {
      stepDoc.classList.remove("locked");
      inputDoc.removeAttribute("disabled");
      
      // Requisito: Apenas se desbloquee el número de documento, hace la consulta
      // a la base de datos de si hay 1 vacante más
      try {
        const stats = await dbService.getVacanciesCount();
        currentAvailableSlots = stats.available;
        formVacanciesText.textContent = `Vacantes confirmadas en la base de datos: ${currentAvailableSlots} de 90`;
        if (currentAvailableSlots < 1) {
          showToast("Aviso: Ya no quedan vacantes libres.", "warning");
        }
      } catch (e) {
        console.warn("Error consultando vacante al desbloquear documento:", e);
      }
    }
  }

  function lockStepDoc() {
    stepDoc.classList.add("locked");
    inputDoc.setAttribute("disabled", "true");
    inputDoc.classList.remove("valid", "invalid");
    feedbackDoc.className = "form-feedback";
  }

  // Campo 2: Documento (Solo números)
  inputDoc.addEventListener("input", async () => {
    const val = inputDoc.value.trim();
    const validNumbersOnly = /^\d{5,15}$/.test(val);

    if (validNumbersOnly) {
      inputDoc.classList.add("valid");
      inputDoc.classList.remove("invalid");
      feedbackDoc.className = "form-feedback";

      // Verificar si este líder ya estuvo registrado anteriormente con su grupo
      checkFormerLeader(val);

      // DESBLOQUEAR CAMPO 3: Correo
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
      if (prev && prev.companions.length > 0) {
        previousRegistrationFound = prev;
        formerGroupBanner.classList.add("active");
        
        if (currentAvailableSlots >= prev.totalGroupSize) {
          formerGroupText.innerHTML = `Detectamos que en tu registro anterior tenías <strong>${prev.companions.length}</strong> acompañante(s) registrado(s). ¿Deseas volver a agregarlos a todos?`;
          btnRestoreGroup.textContent = `Volver a agregar a mis ${prev.companions.length} acompañantes`;
        } else {
          formerGroupText.innerHTML = `Tenías ${prev.companions.length} acompañantes antes, pero solo quedan <strong>${currentAvailableSlots - 1}</strong> vacantes adicionales disponibles.`;
          btnRestoreGroup.textContent = `Agregar hasta ${currentAvailableSlots - 1} acompañantes disponibles`;
        }
      } else {
        formerGroupBanner.classList.remove("active");
      }
    } catch (e) {
      console.warn("Error comprobando historial previo:", e);
    }
  }

  if (btnRestoreGroup) {
    btnRestoreGroup.addEventListener("click", () => {
      if (!previousRegistrationFound) return;
      const allowedCount = Math.min(previousRegistrationFound.companions.length, Math.max(0, currentAvailableSlots - 1));
      companionsList.innerHTML = "";
      companionCount = 0;

      for (let i = 0; i < allowedCount; i++) {
        const c = previousRegistrationFound.companions[i];
        addCompanionCard(c.name, c.email); // Trae nombre y correo, documento se debe ingresar por seguridad
      }
      companionsSection.classList.add("active");
      formerGroupBanner.classList.remove("active");
      showToast("Datos cargados. Por seguridad, ingresa el número de documento de cada acompañante.", "info");
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

  // Campo 3: Correo Electrónico (Validación de Dominios Personales y Corporativos)
  const personalDomains = [
    "gmail.com", "hotmail.com", "yahoo.com", "yahoo.es",
    "outlook.com", "outlook.es", "icloud.com", "me.com", "mac.com", "live.com"
  ];

  inputEmail.addEventListener("blur", () => {
    // Requisito: Si deja el espacio de correo en blanco y toca otro campo
    if (!inputEmail.value.trim() && !stepEmail.classList.contains("locked")) {
      feedbackEmail.className = "form-feedback feedback-warning active";
      feedbackEmail.textContent = "Si es un menor y no tiene correo, puede poner el correo del tutor legal, pero se necesita poner algún correo.";
    }
  });

  inputEmail.addEventListener("input", () => {
    const val = inputEmail.value.trim().toLowerCase();
    
    // Validar formato general de correo
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(val)) {
      inputEmail.classList.remove("valid");
      feedbackEmail.className = "form-feedback";
      updateCompanionButtonVisibility();
      return;
    }

    const domain = val.split("@")[1];

    // Verificar si es un dominio personal permitido
    if (personalDomains.includes(domain)) {
      inputEmail.classList.add("valid");
      inputEmail.classList.remove("invalid");
      feedbackEmail.className = "form-feedback";
      
      // Correo válido -> Habilitar acompañantes y botón de envío
      onLeaderDataComplete();
    } else if (domain.endsWith(".com")) {
      // Requisito: Si después del arroba hay una dirección diferente que finaliza en .com
      inputEmail.classList.add("invalid");
      feedbackEmail.className = "form-feedback feedback-warning active";
      feedbackEmail.textContent = "Usa tu correo personal, para evitar salirse de los T&C del correo corporativo.";
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
    // Calculamos si hay vacantes suficientes para 1 acompañante más
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
    // Consultar nuevamente vacantes a la base de datos
    const stats = await dbService.getVacanciesCount();
    currentAvailableSlots = stats.available;
    const occupiedByThisForm = 1 + companionCount;

    if (currentAvailableSlots <= occupiedByThisForm) {
      showToast("No hay más vacantes disponibles para agregar otro acompañante.", "warning");
      updateCompanionButtonVisibility();
      return;
    }

    // Agregar bloqueo temporal adicional
    await dbService.lockSlotTemporarily(`${currentLockId}-comp-${companionCount + 1}`);

    // Crear formulario de acompañante
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
        <input type="text" class="companion-input comp-name" placeholder="Solo letras y espacios" value="${initialName}" required>
      </div>
      <div class="companion-field">
        <label class="form-label">Número de Documento</label>
        <input type="text" inputmode="numeric" class="companion-input comp-doc" placeholder="Solo dígitos numéricos" required>
      </div>
      <div class="companion-field">
        <label class="form-label">Correo Electrónico (o del tutor si es menor)</label>
        <input type="email" class="companion-input comp-email" placeholder="ejemplo@gmail.com" value="${initialEmail}">
      </div>
      <div class="comp-feedback form-feedback"></div>
    `;

    companionsList.appendChild(card);

    // Event listener para eliminar acompañante
    const removeBtn = card.querySelector(".btn-remove-companion");
    removeBtn.addEventListener("click", () => {
      card.remove();
      companionCount--;
      updateCompanionButtonVisibility();
    });

    updateCompanionButtonVisibility();
  }

  // ==========================================
  // ENVÍO FINAL Y REGISTRO (CON ACCIÓN DE CALENDARIO)
  // ==========================================

  rsvpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 1. Validar datos del líder
    const leaderName = inputName.value.trim();
    const leaderDoc = inputDoc.value.trim();
    const leaderEmail = inputEmail.value.trim();

    if (!leaderName || !leaderDoc || !leaderEmail) {
      showToast("Por favor completa todos tus datos.", "error");
      return;
    }

    // 2. Validar datos de cada acompañante
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
        feedback.textContent = "El documento del acompañante solo debe tener números.";
        return;
      }

      companions.push({
        name: cName,
        document: cDoc,
        email: cEmail
      });
    }

    // Bloquear botón durante el procesamiento
    btnSubmitRegistration.setAttribute("disabled", "true");
    btnSubmitRegistration.innerHTML = `<span class="spinner"></span> Procesando Transacción Atómica...`;

    try {
      // Registrar en base de datos (con commit a GitHub y correo desde maoaza13579@gmail.com)
      const result = await dbService.registerGuest(
        { name: leaderName, document: leaderDoc, email: leaderEmail },
        companions,
        currentLockId
      );

      // Requisito especial: Apenas toca el botón de confirmar asistencia, realiza la acción
      // de llevar al calendario para guardar el evento en Google Calendar
      window.open(config.EVENT.GOOGLE_CALENDAR_URL, "_blank");

      // Cerrar modal
      rsvpModal.classList.remove("active");

      // Renderizar Pase Digital con QR
      await renderVipPass(result.cookieData);

      showToast("¡Asistencia confirmada exitosamente!", "success");
    } catch (err) {
      console.error("Error al registrar:", err);
      showToast(err.message || "Ocurrió un error al registrar tu asistencia.", "error");
      btnSubmitRegistration.removeAttribute("disabled");
      btnSubmitRegistration.innerHTML = `Confirmar mi Asistencia 🎉`;
    }
  });

  // ==========================================
  // RENDERIZADO DEL PASE DIGITAL VIP CON QR
  // ==========================================

  async function renderVipPass(cookieData) {
    if (!vipPassSection) return;

    // Ocultar botón de confirmar asistencia
    if (mainRsvpBtn) mainRsvpBtn.style.display = "none";
    const statusContainer = document.getElementById("vacancies-bar-container");
    if (statusContainer) statusContainer.style.display = "none";

    // Consultar estado en la base de datos para ver si ya ingresó (checked_in)
    let checkedIn = false;
    try {
      const db = await dbService.fetchDatabase();
      const slotObj = db.slots.find(s => s.guest && s.guest.code === cookieData.code);
      if (slotObj && slotObj.guest && slotObj.guest.checked_in) {
        checkedIn = true;
      }
    } catch (e) {}

    vipPassSection.style.display = "block";
    vipPassSection.innerHTML = `
      <div class="vip-pass-card">
        <div class="vip-pass-badge">Pase Oficial de Invitado VIP</div>
        <h2 class="vip-guest-name">${cookieData.name}</h2>
        <div class="vip-slot-info">Puesto Asignado: #${cookieData.slot_number} de 90</div>

        ${checkedIn ? `
          <div class="checked-in-banner">
            🎉 ¡Bienvenido! Ya hiciste tu ingreso a la fiesta.
          </div>
        ` : `
          <div class="qr-code-wrapper" id="pass-qrcode-container"></div>
          <div>
            <div class="vip-pass-code">${cookieData.code}</div>
            <p style="font-size: 12px; color: #ccc; margin-top: 5px;">Presenta este código QR en la entrada el 20 de Diciembre de 2026</p>
          </div>
        `}

        ${cookieData.companions && cookieData.companions.length > 0 ? `
          <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 12px; margin: 15px 0; text-align: left; font-size: 13px;">
            <div style="color: var(--gold-light); font-weight: bold; margin-bottom: 6px;">👥 Tus Acompañantes:</div>
            <ul style="padding-left: 20px; color: #ddd;">
              ${cookieData.companions.map(c => `<li>${c.name} (Puesto #${c.slot_number} - Código: <code>${c.code}</code>)</li>`).join("")}
            </ul>
          </div>
        ` : ''}

        <div class="vip-actions">
          <a target="_blank" href="${config.EVENT.GOOGLE_CALENDAR_URL}" class="btn-calendar-pass">
            📅 Agendar en Google Calendar
          </a>
          <button type="button" class="btn-cancel-pass" id="btn-cancel-my-pass">
            ❌ Cancelar Asistencia
          </button>
        </div>
      </div>
    `;

    // Generar código QR en el contenedor si no ha ingresado
    if (!checkedIn) {
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
    }

    // Botón de Cancelar Asistencia desde el Pase
    const cancelPassBtn = document.getElementById("btn-cancel-my-pass");
    if (cancelPassBtn) {
      cancelPassBtn.addEventListener("click", () => {
        window.location.href = `cancel.html?code=${encodeURIComponent(cookieData.code)}`;
      });
    }
  }

  // ==========================================
  // CONTADOR REGRESIVO A LA FECHA
  // ==========================================

  function initCountdown() {
    const daysEl = document.getElementById("count-days");
    const hoursEl = document.getElementById("count-hours");
    const minsEl = document.getElementById("count-mins");
    const secsEl = document.getElementById("count-secs");
    if (!daysEl) return;

    // 20 de Diciembre de 2026, 7:00 PM (19:00)
    const targetDate = new Date("2026-12-20T19:00:00-05:00").getTime();

    function update() {
      const now = Date.now();
      const diff = targetDate - now;

      if (diff <= 0) {
        daysEl.textContent = "00";
        hoursEl.textContent = "00";
        minsEl.textContent = "00";
        secsEl.textContent = "00";
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

    update();
    setInterval(update, 1000);
  }

  // ==========================================
  // MÚSICA DE FONDO (SINTETIZADA CON WEB AUDIO API)
  // ==========================================

  function initMusicPlayer() {
    const btnMusic = document.getElementById("music-toggle-btn") || document.querySelector(".btn-music-toggle");
    if (!btnMusic) return;

    let audioCtx = null;
    let audioObj = null;
    let audioSource = null;
    let gainNode = null;
    let isPlaying = false;

    btnMusic.addEventListener("click", () => {
      try {
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          // Pista cinemática majestuosa en buffer stream para evitar latencia o bloqueos
          audioObj = new Audio('https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=waltz-of-the-flowers-by-tchaikovsky-8772.mp3');
          audioObj.crossOrigin = "anonymous";
          audioObj.loop = true;

          audioSource = audioCtx.createMediaElementSource(audioObj);
          gainNode = audioCtx.createGain();

          audioSource.connect(gainNode);
          gainNode.connect(audioCtx.destination);
        }

        if (isPlaying) {
          // Fade-out maestro
          if (gainNode) {
            gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 1);
          }
          setTimeout(() => audioObj.pause(), 1000);
          isPlaying = false;
          btnMusic.classList.remove("playing");
          btnMusic.innerHTML = "🔇";
        } else {
          if (audioCtx.state === "suspended") audioCtx.resume();
          audioObj.play().catch(e => console.warn("Audio bloqueado por auto-play policy", e));
          isPlaying = true;
          btnMusic.classList.add("playing");
          btnMusic.innerHTML = "🎵";
          
          // Fade-In majestuoso (aparición gradual)
          if (gainNode) {
            gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 3);
          }
        }
      } catch (err) {
        console.error("Arquitectura de Web Audio prevenida por seguridad del DOM:", err);
        // El bloque catch salva la ejecución global para que la cuenta regresiva no falle.
      }
    });
  }

  // ==========================================
  // CANVAS DE DESTELLOS Y ESTRELLAS
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

    const stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.8 + 0.5,
        alpha: Math.random(),
        speed: Math.random() * 0.02 + 0.005,
        color: Math.random() > 0.4 ? "242, 73, 231" : "229, 195, 120"
      });
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        s.alpha += s.speed;
        if (s.alpha > 1 || s.alpha < 0) s.speed = -s.speed;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color}, ${Math.abs(s.alpha)})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = `rgba(${s.color}, 0.8)`;
        ctx.fill();
      }
      requestAnimationFrame(animate);
    }
    animate();
  }

  // ==========================================
  // HELPER DE NOTIFICACIONES TOAST
  // ==========================================

  window.showToast = function(msg, type = "info") {
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icon = type === "error" ? "❌" : type === "success" ? "✅" : type === "warning" ? "⚠️" : "ℹ️";
    toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "fade-out 0.3s forwards";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };
});
