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

  // Determinar identificador inicial
  let targetIdentifier = null;

  if (paramToken) {
    try {
      const tokenData = JSON.parse(atob(decodeURIComponent(paramToken)));
      if (tokenData && (tokenData.doc || tokenData.code)) {
        targetIdentifier = tokenData.doc || tokenData.code;
      }
    } catch (e) {
      console.warn("Token no decodificable:", e);
    }
  }

  if (!targetIdentifier && paramCode) {
    targetIdentifier = paramCode.trim();
  }

  if (!targetIdentifier && paramDoc) {
    targetIdentifier = paramDoc.trim();
  }

  // Si no viene por URL, revisar si tiene cookie en este dispositivo
  if (!targetIdentifier) {
    const cookie = dbService.getAttendanceCookie();
    if (cookie && (cookie.code || cookie.document)) {
      targetIdentifier = cookie.code || cookie.document;
    }
  }

  if (targetIdentifier) {
    await loadCancellationData(targetIdentifier);
  } else {
    // Modo búsqueda manual por documento
    if (cancelFlowSection) cancelFlowSection.style.display = "none";
    if (searchDocSection) searchDocSection.style.display = "block";
  }

  // ==========================================
  // BÚSQUEDA MANUAL POR DOCUMENTO
  // ==========================================
  if (formRequestDoc) {
    formRequestDoc.addEventListener("submit", async (e) => {
      e.preventDefault();
      const doc = inputSearchDoc.value.trim();
      if (!/^\d{5,15}$/.test(doc)) {
        window.showTopNotice("Por favor ingresa un número de documento válido (solo números).", "warning", 3500);
        return;
      }

      btnSendCancelLink.setAttribute("disabled", "true");
      btnSendCancelLink.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:8px;vertical-align:middle;"></span> Verificando en base de datos...`;
      window.showTopNotice("Buscando registro en la base de datos...", "loading");

      try {
        const details = await dbService.getGroupDetailsForCancellation(doc);
        if (details) {
          window.hideTopNotice();
          await loadCancellationData(doc);
        } else {
          window.showTopNotice("No existe ninguna confirmación de asistencia activa con este número de documento.", "error", 4500);
          btnSendCancelLink.removeAttribute("disabled");
          btnSendCancelLink.innerHTML = "Buscar y Gestionar Asistencia";
        }
      } catch (err) {
        window.showTopNotice(err.message || "No se encontró ningún registro con ese documento.", "error", 4500);
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
    window.showTopNotice("Cargando información del registro...", "loading");

    try {
      const details = await dbService.getGroupDetailsForCancellation(identifier);
      window.hideTopNotice();

      if (!details || !details.guest) {
        window.showTopNotice("No se encontró ningún registro activo para este código o documento.", "error", 4500);
        if (searchDocSection) searchDocSection.style.display = "block";
        if (cancelFlowSection) cancelFlowSection.style.display = "none";
        return;
      }

      currentGroupDetails = details;
      const guest = details.guest;

      if (searchDocSection) searchDocSection.style.display = "none";
      if (cancelFlowSection) cancelFlowSection.style.display = "block";

      // Renderizar datos del invitado
      cancelGuestName.textContent = guest.name;
      cancelSlotBadge.textContent = `Puesto #${guest.slot_number} (Código: ${guest.code})`;

      if (details.isLeader) {
        // ES LÍDER DEL GRUPO
        if (companionWarningBox) companionWarningBox.style.display = "none";

        if (details.companions && details.companions.length > 0) {
          if (leaderGroupOptions) leaderGroupOptions.style.display = "block";
          renderCompanionsChecklist(details.companions);
          setupRadioListeners();
        } else {
          if (leaderGroupOptions) leaderGroupOptions.style.display = "none";
          btnConfirmCancel.textContent = "Cancelar mi Asistencia";
        }
      } else {
        // ES UN ACOMPAÑANTE
        if (leaderGroupOptions) leaderGroupOptions.style.display = "none";
        if (companionWarningBox) {
          companionWarningBox.style.display = "block";
          companionWarningBox.innerHTML = `
            ℹ️ <strong>Nota:</strong> Fuiste registrado como acompañante por <strong>${escapeHtml(guest.leader_name || "el líder de tu grupo")}</strong>.<br>
            Puedes cancelar tu propia asistencia de inmediato para liberar tu cupo a otro invitado.
          `;
        }
        btnConfirmCancel.textContent = "Cancelar mi Asistencia";
      }

      // Reiniciar validador de frase de seguridad
      inputSecurityPhrase.value = "";
      checkSecurityPhrase();

    } catch (err) {
      console.error("Error al cargar datos:", err);
      window.showTopNotice("Error al cargar la información: " + err.message, "error", 4500);
    }
  }

  // ==========================================
  // CHECKLIST DE ACOMPAÑANTES DEL LÍDER
  // ==========================================
  function renderCompanionsChecklist(companions) {
    if (!companionsChecklist) return;
    companionsChecklist.innerHTML = "";

    companions.forEach((comp) => {
      const item = document.createElement("div");
      item.className = "checklist-item";
      item.innerHTML = `
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 6px 0;">
          <input type="checkbox" class="chk-companion" value="${escapeHtml(comp.code)}" checked>
          <span><strong>${escapeHtml(comp.name)}</strong> (Puesto #${comp.slot_number} - Doc: ${escapeHtml(comp.document)})</span>
        </label>
      `;
      companionsChecklist.appendChild(item);
    });

    const checkboxes = companionsChecklist.querySelectorAll(".chk-companion");
    checkboxes.forEach(chk => {
      chk.addEventListener("change", updateLeaderButtonText);
    });

    updateLeaderButtonText();
  }

  function setupRadioListeners() {
    if (radioOnlyMe) {
      radioOnlyMe.addEventListener("change", () => {
        if (radioOnlyMe.checked) {
          if (companionsChecklistContainer) companionsChecklistContainer.style.display = "none";
          btnConfirmCancel.textContent = "Cancelar solo mi Asistencia";
        }
      });
    }

    if (radioAllGroup) {
      radioAllGroup.addEventListener("change", () => {
        if (radioAllGroup.checked) {
          if (companionsChecklistContainer) companionsChecklistContainer.style.display = "block";
          updateLeaderButtonText();
        }
      });
    }
  }

  function updateLeaderButtonText() {
    if (radioOnlyMe && radioOnlyMe.checked) {
      btnConfirmCancel.textContent = "Cancelar solo mi Asistencia";
      return;
    }

    if (!companionsChecklist) {
      btnConfirmCancel.textContent = "Cancelar mi Asistencia";
      return;
    }

    const checkboxes = companionsChecklist.querySelectorAll(".chk-companion");
    const total = checkboxes.length;
    let selected = 0;

    checkboxes.forEach(c => {
      if (c.checked) selected++;
    });

    if (selected === total) {
      btnConfirmCancel.textContent = "Cancelar asistencia de todos";
    } else if (selected === 0) {
      btnConfirmCancel.textContent = "Cancelar solo mi Asistencia";
    } else {
      btnConfirmCancel.textContent = `Eliminarte y a ${selected} persona(s) más`;
    }
  }

  // ==========================================
  // VALIDACIÓN DE FRASE DE SEGURIDAD
  // "CANCELAR asistencia"
  // ==========================================
  if (inputSecurityPhrase) {
    inputSecurityPhrase.addEventListener("input", checkSecurityPhrase);
  }

  function checkSecurityPhrase() {
    if (!inputSecurityPhrase) return;
    const val = inputSecurityPhrase.value;
    const requiredPhrase = config.CANCEL_SECURITY_PHRASE || "CANCELAR asistencia";

    if (val === requiredPhrase) {
      if (phraseMatchStatus) {
        phraseMatchStatus.innerHTML = `<span style="color: #28a745; font-size: 13px; font-weight: 600;">✓ Frase correcta</span>`;
      }
      btnConfirmCancel.removeAttribute("disabled");
      btnConfirmCancel.classList.add("phrase-valid");
    } else {
      if (phraseMatchStatus) {
        phraseMatchStatus.innerHTML = `<span style="color: #ff8595; font-size: 12px;">Escribe exactamente: <strong>${escapeHtml(requiredPhrase)}</strong></span>`;
      }
      btnConfirmCancel.setAttribute("disabled", "true");
      btnConfirmCancel.classList.remove("phrase-valid");
    }
  }

  // ==========================================
  // CONFIRMACIÓN Y CANCELACIÓN EN GITHUB
  // ==========================================
  if (btnConfirmCancel) {
    btnConfirmCancel.addEventListener("click", async () => {
      const requiredPhrase = config.CANCEL_SECURITY_PHRASE || "CANCELAR asistencia";
      if (inputSecurityPhrase.value !== requiredPhrase) {
        window.showTopNotice("Debes escribir la frase exacta de confirmación.", "warning", 3500);
        return;
      }

      btnConfirmCancel.setAttribute("disabled", "true");
      btnConfirmCancel.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:8px;vertical-align:middle;"></span> Eliminando de GitHub...`;
      window.showTopNotice("Eliminando registro y liberando puesto(s) en GitHub...", "loading");

      try {
        let options = {
          cancelAllGroup: false,
          specificCodes: null,
          purgeFull: false
        };

        if (currentGroupDetails && currentGroupDetails.isLeader && radioAllGroup && radioAllGroup.checked) {
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

        // Ejecutar cancelación transaccional en GitHub
        const result = await dbService.cancelAttendance(currentTargetIdentifier, options);

        // Ocultar formulario y mostrar confirmación de éxito
        if (cancelFlowSection) cancelFlowSection.style.display = "none";
        if (cancelSuccessBox) cancelSuccessBox.style.display = "block";

        const countTextEl = document.getElementById("released-count-text");
        if (countTextEl) {
          countTextEl.textContent = `Se han liberado con éxito ${result.releasedCount} puesto(s). Los datos fueron eliminados y actualizados en GitHub.`;
        }

        window.showTopNotice("Asistencia cancelada exitosamente en GitHub.", "success", 4500);

      } catch (err) {
        console.error("Error al cancelar:", err);
        window.showTopNotice(err.message || "Error al cancelar en GitHub. El cupo no fue eliminado.", "error", 6000);
        btnConfirmCancel.removeAttribute("disabled");
        btnConfirmCancel.innerHTML = "Reintentar Cancelación";
      }
    });
  }
});
