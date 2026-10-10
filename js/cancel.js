/**
 * ==========================================================================
 * CANCEL.JS - CONTROLADOR DE CANCELACIÓN DE ASISTENCIA
 * Manejo de líderes de grupo vs acompañantes y validación estricta de seguridad
 * Frase requerida: "CANCELAR asistencia"
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
  const config = window.APP_CONFIG;
  const dbService = window.dbService;

  const urlParams = new URLSearchParams(window.location.search);
  const paramCode = urlParams.get("code");
  const paramDoc = urlParams.get("doc");
  const paramToken = urlParams.get("token");

  // Elementos DOM
  const searchDocSection = document.getElementById("search-doc-section");
  const formRequestDoc = document.getElementById("form-request-doc");
  const inputSearchDoc = document.getElementById("input-search-doc");
  const btnSendCancelLink = document.getElementById("btn-send-cancel-link");

  const cancelFlowSection = document.getElementById("cancel-flow-section");
  const cancelGuestName = document.getElementById("cancel-guest-name");
  const cancelSlotBadge = document.getElementById("cancel-slot-badge");
  const leaderGroupOptions = document.getElementById("leader-group-options");
  const radioOnlyMe = document.getElementById("radio-only-me");
  const radioAllGroup = document.getElementById("radio-all-group");
  const companionsChecklistContainer = document.getElementById("companions-checklist-container");
  const companionsChecklist = document.getElementById("companions-checklist");
  const companionWarningBox = document.getElementById("companion-warning-box");

  const inputSecurityPhrase = document.getElementById("input-security-phrase");
  const phraseMatchStatus = document.getElementById("phrase-match-status");
  const btnConfirmCancel = document.getElementById("btn-confirm-cancel");
  const cancelSuccessBox = document.getElementById("cancel-success-box");

  let currentTargetIdentifier = null;
  let currentGroupDetails = null;

  // 1. Determinar identificador inicial (por parámetro URL o cookie)
  let initialId = paramCode || paramDoc;
  if (!initialId && paramToken) {
    try {
      const decoded = JSON.parse(atob(decodeURIComponent(paramToken)));
      initialId = decoded.code || decoded.doc;
    } catch (e) {}
  }

  if (!initialId) {
    // Si no hay parámetro, comprobar si este dispositivo tiene la cookie
    const cookie = dbService.getAttendanceCookie();
    if (cookie && cookie.code) {
      initialId = cookie.code;
    }
  }

  if (initialId) {
    await loadCancellationData(initialId);
  } else {
    // Mostrar formulario para ingresar documento
    searchDocSection.style.display = "block";
    cancelFlowSection.style.display = "none";
  }

  // ==========================================
  // SOLICITUD DE ENLACE POR DOCUMENTO
  // ==========================================

  if (formRequestDoc) {
    formRequestDoc.addEventListener("submit", async (e) => {
      e.preventDefault();
      const doc = inputSearchDoc.value.trim();
      if (!/^\d{5,15}$/.test(doc)) {
        showToast("Por favor ingresa un número de documento válido.", "error");
        return;
      }

      btnSendCancelLink.setAttribute("disabled", "true");
      btnSendCancelLink.innerHTML = `<span class="spinner"></span> Verificando...`;

      try {
        const res = await dbService.requestCancelLink(doc);
        if (res.backend) {
          showToast(`Enlace enviado a ${res.email}. Por favor revisa tu bandeja de entrada o spam.`, "success");
        } else {
          // Si estamos en modo directo / local, cargamos directamente
          showToast("Registro encontrado. Cargando opciones de cancelación...", "info");
          setTimeout(() => loadCancellationData(doc), 1000);
        }
      } catch (err) {
        showToast(err.message || "No se encontró ningún registro con ese documento.", "error");
        btnSendCancelLink.removeAttribute("disabled");
        btnSendCancelLink.innerHTML = "Buscar y Gestionar Asistencia";
      }
    });
  }

  // ==========================================
  // CARGA DE DATOS PARA CANCELAR
  // ==========================================

  async function loadCancellationData(identifier) {
    currentTargetIdentifier = identifier;
    searchDocSection.style.display = "none";
    cancelFlowSection.style.display = "block";

    try {
      const details = await dbService.getGroupDetailsForCancellation(identifier);
      if (!details) {
        showToast("No se encontró ningún registro activo para este código.", "error");
        searchDocSection.style.display = "block";
        cancelFlowSection.style.display = "none";
        return;
      }

      currentGroupDetails = details;
      const guest = details.guest;

      // Renderizar datos del invitado
      cancelGuestName.textContent = guest.name;
      cancelSlotBadge.textContent = `Puesto #${guest.slot_number} (Código: ${guest.code})`;

      if (details.isLeader) {
        // ES LÍDER DEL GRUPO
        companionWarningBox.style.display = "none";

        if (details.companions && details.companions.length > 0) {
          leaderGroupOptions.style.display = "block";
          renderCompanionsChecklist(details.companions);
          setupRadioListeners();
        } else {
          // Líder solo sin acompañantes
          leaderGroupOptions.style.display = "none";
          btnConfirmCancel.textContent = "Cancelar mi Asistencia";
        }
      } else {
        // ES UN ACOMPAÑANTE
        leaderGroupOptions.style.display = "none";
        companionWarningBox.style.display = "block";
        companionWarningBox.innerHTML = `
          ℹ️ <strong>Nota:</strong> Fuiste registrado como acompañante por <strong>${guest.leader_name || "el líder de tu grupo"}</strong>.<br>
          Si deseas cancelar a todos los que fueron registrados contigo, debes comunicarte con <strong>${guest.leader_name || "el líder del grupo"}</strong> para eliminar a todos los demás, pero puedes cancelar tu propia asistencia de inmediato.
        `;
        btnConfirmCancel.textContent = "Cancelar mi Asistencia";
      }

      // Reiniciar validador de frase de seguridad
      inputSecurityPhrase.value = "";
      checkSecurityPhrase();

    } catch (err) {
      console.error("Error al cargar datos:", err);
      showToast("Error al cargar la información.", "error");
    }
  }

  // ==========================================
  // CHECKLIST DE ACOMPAÑANTES DEL LÍDER
  // ==========================================

  function renderCompanionsChecklist(companions) {
    companionsChecklist.innerHTML = "";
    companions.forEach((comp, idx) => {
      const item = document.createElement("div");
      item.className = "checklist-item";
      item.innerHTML = `
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 6px 0;">
          <input type="checkbox" class="chk-companion" value="${comp.code}" checked>
          <span><strong>${comp.name}</strong> (Puesto #${comp.slot_number} - Doc: ${comp.document})</span>
        </label>
      `;
      companionsChecklist.appendChild(item);
    });

    // Detectar cambios en las casillas seleccionadas
    const checkboxes = companionsChecklist.querySelectorAll(".chk-companion");
    checkboxes.forEach(chk => {
      chk.addEventListener("change", updateLeaderButtonText);
    });

    updateLeaderButtonText();
  }

  function setupRadioListeners() {
    radioOnlyMe.addEventListener("change", () => {
      if (radioOnlyMe.checked) {
        companionsChecklistContainer.style.display = "none";
        btnConfirmCancel.textContent = "Cancelar solo mi Asistencia";
      }
    });

    radioAllGroup.addEventListener("change", () => {
      if (radioAllGroup.checked) {
        companionsChecklistContainer.style.display = "block";
        updateLeaderButtonText();
      }
    });
  }

  function updateLeaderButtonText() {
    if (!radioAllGroup.checked) {
      btnConfirmCancel.textContent = "Cancelar solo mi Asistencia";
      return;
    }

    const checkboxes = companionsChecklist.querySelectorAll(".chk-companion");
    const total = checkboxes.length;
    let selected = 0;

    checkboxes.forEach(c => {
      if (c.checked) selected++;
    });

    // Requisito estricto:
    // Si todos están seleccionados -> "Cancelar asistencia de todos"
    // Si hay al menos 1 que no se seleccionó -> "Eliminarte y a X personas más"
    if (selected === total) {
      btnConfirmCancel.textContent = "Cancelar asistencia de todos";
    } else if (selected === 0) {
      btnConfirmCancel.textContent = "Cancelar solo mi Asistencia";
    } else {
      btnConfirmCancel.textContent = `Eliminarte y a ${selected} persona(s) más`;
    }
  }

  // ==========================================
  // VALIDACIÓN ESTRICTA DE FRASE DE SEGURIDAD
  // Requisito: Debe escribir exactamente "CANCELAR asistencia"
  // ==========================================

  inputSecurityPhrase.addEventListener("input", checkSecurityPhrase);

  function checkSecurityPhrase() {
    const val = inputSecurityPhrase.value;
    const requiredPhrase = config.CANCEL_SECURITY_PHRASE; // "CANCELAR asistencia"

    if (val === requiredPhrase) {
      phraseMatchStatus.innerHTML = `<span style="color: #28a745; font-size: 13px;">✓ Frase correcta</span>`;
      btnConfirmCancel.removeAttribute("disabled");
      btnConfirmCancel.classList.add("phrase-valid");
    } else {
      phraseMatchStatus.innerHTML = `<span style="color: #ff8595; font-size: 12px;">Escribe exactamente: <strong>${requiredPhrase}</strong></span>`;
      btnConfirmCancel.setAttribute("disabled", "true");
      btnConfirmCancel.classList.remove("phrase-valid");
    }
  }

  // ==========================================
  // CONFIRMACIÓN Y EJECUCIÓN DE CANCELACIÓN
  // ==========================================

  btnConfirmCancel.addEventListener("click", async () => {
    if (inputSecurityPhrase.value !== config.CANCEL_SECURITY_PHRASE) {
      showToast("Debes escribir la frase exacta de confirmación.", "error");
      return;
    }

    btnConfirmCancel.setAttribute("disabled", "true");
    btnConfirmCancel.innerHTML = `<span class="spinner"></span> Cancelando cupo(s)...`;

    try {
      let options = {
        cancelAllGroup: false,
        specificCodes: null
      };

      if (currentGroupDetails.isLeader && radioAllGroup.checked) {
        const checkboxes = companionsChecklist.querySelectorAll(".chk-companion");
        const total = checkboxes.length;
        const selectedCodes = [];
        checkboxes.forEach(c => {
          if (c.checked) selectedCodes.push(c.value);
        });

        if (selectedCodes.length === total) {
          options.cancelAllGroup = true;
        } else {
          options.specificCodes = selectedCodes;
        }
      }

      // Ejecutar cancelación en base de datos
      const result = await dbService.cancelAttendance(currentTargetIdentifier, options);

      // Ocultar formulario y mostrar confirmación de éxito
      cancelFlowSection.style.display = "none";
      cancelSuccessBox.style.display = "block";
      document.getElementById("released-count-text").textContent = 
        `Se han liberado con éxito ${result.releasedCount} puesto(s). Los datos fueron actualizados en la base de datos de GitHub.`;

      showToast("Asistencia cancelada exitosamente.", "success");

    } catch (err) {
      console.error("Error al cancelar:", err);
      showToast(err.message || "Error al cancelar la asistencia.", "error");
      btnConfirmCancel.removeAttribute("disabled");
      btnConfirmCancel.innerHTML = "Reintentar Cancelación";
    }
  });

  // Helper Toast
  function showToast(msg, type = "info") {
    if (window.showToast) {
      window.showToast(msg, type);
    } else {
      alert(msg);
    }
  }
});
