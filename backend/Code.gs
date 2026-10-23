/** Emojis con su codificaion (Entidad HTML Decimal)
 * ⚠️ (Advertencia): &#9888;
 * ✨ (Chispas): &#10024;
 * 📅 (Calendario): &#128197;
 * 📢 (Bocina): &#128363;
 */

/**
 * ====================================================================
 * BACKEND GOOGLE APPS SCRIPT - LOS 15 DE SARA SOFÍA ORTEGA AYALA
 * Repositorio: https://github.com/MAOAZAking/los-15-de-sara-sofia-ortega
 * Correo emisor: maoaza13579@gmail.com
 * ====================================================================
 * 
 * Este script se despliega como "Aplicación web" (Web App) en Google Apps Script
 * bajo la cuenta maoaza13579@gmail.com.
 * Realiza dos funciones clave:
 * 1. Envía correos electrónicos automáticos desde tu propio Gmail (confirmación,
 *    código QR, botón de Google Calendar y link de cancelación).
 * 2. Realiza commits directos a tu repositorio de GitHub actualizando data/database.json,
 *    manteniendo tu GitHub Personal Access Token 100% seguro en las Propiedades del Script.
 */

// Configuración básica del repositorio en GitHub
const GITHUB_OWNER = "MAOAZAking";
const GITHUB_REPO = "los-15-de-sara-sofia-ortega";
const GITHUB_BRANCH = "main";
const DB_FILE_PATH = "data/database.json";

// Configuración del evento
const EVENT_NAME = "Los 15 Años de Sara Sofía Ortega Ayala";
const EVENT_DATE = "Domingo, 20 de Diciembre de 2026 - 5:00 PM";
const EVENT_VENUE = "Cra. 23 # 56-50, Comuna 8, Cali, Valle del Cauca";
const MAPS_URL = "https://www.google.com/maps/dir//Cra.+23+%2356-50,+Comuna+8,+Cali,+Valle+del+Cauca/@3.4417114,-76.4965274,17z/data=!4m18!1m8!3m7!1s0x8e30a70733ebf565:0xc9f09c63545da21c!2sCra.+23+%2356-50,+Comuna+8,+Cali,+Valle+del+Cauca!3b1!8m2!3d3.4415515!4d-76.4965047!16s%2Fg%2F11vjm1vyjl!4m8!1m0!1m5!1m1!1s0x8e30a70733ebf565:0xc9f09c63545da21c!2m2!1d-76.4965047!2d3.4415515!3e0?entry=ttu";
const CALENDAR_URL = "https://drive.google.com/uc?export=download&id=1Y9keX4gxIq8T5jqC60YuNZyEEs4g4bd8";
const PRIMARY_COLOR = "#F249E7";

/**
 * Manejo de peticiones GET (Consultas de base de datos)
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "get_db";

  try {
    if (action === "get_db") {
      const db = getDatabaseFromGitHub();
      return createJsonResponse(db);
    }

    if (action === "get_vacancies") {
      const db = getDatabaseFromGitHub();
      let occupied = 0;
      if (db && db.slots) {
        db.slots.forEach(function(s) {
          if (s.guest !== null) occupied++;
        });
      }
      const available = Math.max(0, 90 - occupied);
      return createJsonResponse({
        success: true,
        available_slots: available,
        occupied_slots: occupied,
        total_slots: 90
      });
    }

    if (action === "ping") {
      return createJsonResponse({
        success: true,
        message: "Backend de Los 15 de Sara Sofía activo y conectado",
        timestamp: new Date().toISOString()
      });
    }

    return createJsonResponse({ error: "Acción GET no reconocida: " + action });
  } catch (error) {
    return createJsonResponse({ error: error.toString() });
  }
}

/**
 * Manejo transaccional de peticiones POST
 * Validación estricta: NO se envían correos si el commit en GitHub falla.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        success: false,
        error: "Estructura de red inválida: El cuerpo de la solicitud (body) está vacío."
      });
    }

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (jsonErr) {
      return createJsonResponse({
        success: false,
        error: "Error de formato: El contenido enviado no es un JSON válido."
      });
    }

    const action = payload.action;
    if (!action) {
      return createJsonResponse({
        success: false,
        error: "Acción requerida: No se especificó el parámetro 'action'."
      });
    }

    // ==========================================
    // 0. LOGIN SEGURO DEL ADMINISTRADOR
    // ==========================================
    if (action === "admin_login") {
      const scriptProps = PropertiesService.getScriptProperties();
      const validUser = scriptProps.getProperty("ADMIN_USER") || "admin";
      const validPass = scriptProps.getProperty("ADMIN_PASS") || "Sara15Admin2026";

      if (!payload.user || !payload.pass) {
        return createJsonResponse({ success: false, error: "Campos incompletos: Se requiere 'user' y 'pass'." });
      }

      if (payload.user.trim() === validUser.trim() && payload.pass.trim() === validPass.trim()) {
        return createJsonResponse({ success: true, token: "VIP_AUTH_GRANTED" });
      }

      return createJsonResponse({ success: false, error: "Credenciales incorrectas: El usuario o la contraseña no coinciden." });
    }

    // ==========================================
    // 1. REGISTRAR ASISTENCIA Y COMITEAR A GITHUB
    // ==========================================
    if (action === "register") {
      if (!payload.leader || !payload.leader.name) {
        return createJsonResponse({
          success: false,
          error: "Datos faltantes: Se requiere información del 'leader' (al menos el campo 'name')."
        });
      }
      if (!payload.database) {
        return createJsonResponse({
          success: false,
          error: "Datos faltantes: No se adjuntó el estado de la 'database'."
        });
      }

      const leader = payload.leader;
      const companions = payload.companions || [];
      const commitMessage = payload.commit_message || `Confirmación de asistencia: ${leader.name}`;

      // 1. PRIMERO HACER EL COMMIT EN GITHUB
      let commitResult;
      try {
        commitResult = commitDatabaseToGitHub(payload.database, commitMessage);
      } catch (gitErr) {
        // DETIENE EL FLUJO INMEDIATAMENTE: CERO CORREOS SI FALLA EL GUARDADO EN GITHUB
        return createJsonResponse({
          success: false,
          error: "Fallo crítico en GitHub: No se pudo guardar el registro en el repositorio. Detalle: " + gitErr.message
        });
      }

      // 2. SOLO SI EL COMMIT FUE EXITOSO Y TIENE CORREO VÁLIDO SE ENVÍA EL CORREO
      if (leader.email && leader.email.includes("@")) {
        try {
          sendConfirmationEmail(leader, companions);
        } catch (mailErr) {
          Logger.log("Aviso: Commit guardado pero error enviando email: " + mailErr.toString());
        }
      }

      return createJsonResponse({
        success: true,
        commit: commitResult,
        email_sent_to: leader.email || null
      });
    }

    // ==========================================
    // 2. CANCELAR ASISTENCIA Y COMITEAR A GITHUB
    // ==========================================
    if (action === "cancel") {
      if (!payload.requester || !payload.requester.name || !payload.requester.email) {
        return createJsonResponse({
          success: false,
          error: "Datos faltantes: Se requiere información del 'requester' (name y email)."
        });
      }
      if (!payload.database) {
        return createJsonResponse({
          success: false,
          error: "Datos faltantes: Falta el estado de la 'database'."
        });
      }

      const requester = payload.requester;
      const releasedSlots = payload.released_slots || [];
      const commitMessage = payload.commit_message || `Cancelación de asistencia: ${requester.name}`;

      // 1. PRIMERO IMPACTAR GITHUB
      let commitResult;
      try {
        commitResult = commitDatabaseToGitHub(payload.database, commitMessage);
      } catch (gitErr) {
        return createJsonResponse({
          success: false,
          error: "Fallo crítico en GitHub: No se pudo procesar la cancelación en el repositorio. Detalle: " + gitErr.message
        });
      }

      // 2. SOLO SI SE GUARDÓ EN GITHUB, ENVIAR EMAIL DE CONFIRMACIÓN
      try {
        sendCancellationConfirmedEmail(requester, releasedSlots.length || 1);
      } catch (mailErr) {
        Logger.log("Aviso: Commit guardado pero error enviando email de cancelación: " + mailErr.toString());
      }

      return createJsonResponse({
        success: true,
        commit: commitResult,
        released: releasedSlots.length || 1
      });
    }

    // ==========================================
    // 3. PURGA / ELIMINACIÓN DESDE EL ADMIN
    // ==========================================
    if (action === "admin_purge") {
      if (!payload.database) {
        return createJsonResponse({ success: false, error: "Falta el payload de database." });
      }

      const commitMessage = payload.commit_message || "Purga administrativa de puesto";
      let commitResult;
      try {
        commitResult = commitDatabaseToGitHub(payload.database, commitMessage);
      } catch (gitErr) {
        return createJsonResponse({
          success: false,
          error: "Fallo al purgar en GitHub: " + gitErr.message
        });
      }

      return createJsonResponse({ success: true, commit: commitResult });
    }

    // ==========================================
    // 4. CHECK-IN / INGRESO DE INVITADO
    // ==========================================
    if (action === "check_in") {
      if (!payload.database) {
        return createJsonResponse({ success: false, error: "Falta el payload de la 'database'." });
      }

      const guestName = (payload.guest && payload.guest.name) ? payload.guest.name : "Invitado";
      const commitMessage = payload.commit_message || `Ingreso de invitado: ${guestName}`;

      let commitResult;
      try {
        commitResult = commitDatabaseToGitHub(payload.database, commitMessage);
      } catch (gitErr) {
        return createJsonResponse({
          success: false,
          error: "Fallo crítico en GitHub al registrar ingreso: " + gitErr.message
        });
      }

      return createJsonResponse({ success: true, commit: commitResult });
    }

    // ==========================================
    // 5. ENVIAR LINK DE CANCELACIÓN AL CORREO
    // ==========================================
    if (action === "send_cancel_email") {
      if (!payload.email || !payload.name || !payload.cancel_url) {
        return createJsonResponse({
          success: false,
          error: "Datos faltantes: Se requiere 'email', 'name' y 'cancel_url'."
        });
      }

      sendCancelLinkEmail(payload.email, payload.name, payload.cancel_url);
      return createJsonResponse({ success: true, sent_to: payload.email });
    }

    return createJsonResponse({
      success: false,
      error: `Acción POST no reconocida: '${action}'`
    });

  } catch (error) {
    Logger.log("Error crítico en doPost: " + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message || error.toString()
    });
  }
}

/**
 * Obtener base de datos actual desde GitHub vía API REST o Raw
 */
function getDatabaseFromGitHub() {
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DB_FILE_PATH}?ref=${GITHUB_BRANCH}`;

  const headers = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Sara15-GAS-Backend"
  };
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }

  try {
    const response = UrlFetchApp.fetch(apiUrl, {
      method: "get",
      headers: headers,
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const json = JSON.parse(response.getContentText());
      const decodedContent = Utilities.newBlob(Utilities.base64Decode(json.content)).getDataAsString("UTF-8");
      return JSON.parse(decodedContent);
    }
  } catch (apiErr) {
    Logger.log("Aviso: Error en API GitHub, intentando Raw: " + apiErr.toString());
  }

  // Fallback mediante Raw con nocache
  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${DB_FILE_PATH}?nocache=${Date.now()}`;
  const rawResponse = UrlFetchApp.fetch(rawUrl, {
    method: "get",
    muteHttpExceptions: true
  });

  if (rawResponse.getResponseCode() === 200) {
    return JSON.parse(rawResponse.getContentText());
  }

  throw new Error("No se pudo obtener el archivo de base de datos desde GitHub. Código: " + rawResponse.getResponseCode());
}

/**
 * Realizar commit directo en GitHub actualizando data/database.json
 */
function commitDatabaseToGitHub(databaseObj, message) {
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) {
    throw new Error("GITHUB_TOKEN no configurado en ScriptProperties del proyecto de Google Apps Script. Por favor configura la propiedad GITHUB_TOKEN.");
  }

  const fileUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DB_FILE_PATH}`;

  // 1. Obtener SHA actual del archivo
  const getFileRes = UrlFetchApp.fetch(fileUrl + `?ref=${GITHUB_BRANCH}`, {
    method: "get",
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Sara15-GAS-Backend"
    },
    muteHttpExceptions: true
  });

  let sha = "";
  if (getFileRes.getResponseCode() === 200) {
    const fileInfo = JSON.parse(getFileRes.getContentText());
    sha = fileInfo.sha;
  } else if (getFileRes.getResponseCode() !== 404) {
    throw new Error("GitHub error al consultar SHA (HTTP " + getFileRes.getResponseCode() + "): " + getFileRes.getContentText());
  }

  // 2. Codificar contenido en Base64 UTF-8
  const jsonString = JSON.stringify(databaseObj, null, 2);
  const base64Content = Utilities.base64Encode(Utilities.newBlob(jsonString, "application/json").getBytes());

  // 3. Crear el commit vía PUT
  const commitPayload = {
    message: message,
    content: base64Content,
    branch: GITHUB_BRANCH
  };
  if (sha) {
    commitPayload.sha = sha;
  }

  const putRes = UrlFetchApp.fetch(fileUrl, {
    method: "put",
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "Sara15-GAS-Backend"
    },
    payload: JSON.stringify(commitPayload),
    muteHttpExceptions: true
  });

  const statusCode = putRes.getResponseCode();
  if (statusCode === 200 || statusCode === 201) {
    return JSON.parse(putRes.getContentText());
  } else {
    throw new Error("GitHub rechazó el commit (HTTP " + statusCode + "): " + putRes.getContentText());
  }
}

/**
 * Enviar correo de confirmación de asistencia desde maoaza13579@gmail.com
 */
function sendConfirmationEmail(leader, companions) {
  const toEmail = leader.email;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(leader.code)}`;

  let companionsHtml = "";
  if (companions && companions.length > 0) {
    companionsHtml = `
      <div style="background: rgba(242, 73, 231, 0.08); border-radius: 8px; padding: 15px; margin: 15px 0; border: 1px solid rgba(242, 73, 231, 0.2);">
        <h4 style="margin: 0 0 10px 0; color: #b515ab; font-size: 15px;">&#128101; Acompañantes registrados contigo:</h4>
        <ul style="margin: 0; padding-left: 20px; color: #444;">
          ${companions.map(function(c) {
            return `<li><strong>${c.name}</strong> (Puesto #${c.slot_number} - Código: <code>${c.code}</code>)</li>`;
          }).join("")}
        </ul>
      </div>
    `;
  }

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #fff2fc; margin: 0; padding: 20px; color: #333; }
        .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid rgba(242, 73, 231, 0.2); }
        .header { background: linear-gradient(135deg, #1f0b2b 0%, #3e1047 100%); padding: 40px 20px; text-align: center; color: #ffffff; }
        .gold-years { font-size: 46px; font-weight: 900; color: #f3ca65; text-shadow: 0px 0px 12px rgba(243, 202, 101, 0.6); margin: 0; line-height: 1.1; font-family: 'Georgia', serif; }
        .gold-subtitle { font-size: 14px; text-transform: uppercase; letter-spacing: 4px; color: #f3ca65; margin-bottom: 15px; font-weight: bold; }
        .title { font-size: 28px; font-weight: bold; margin: 10px 0 5px 0; color: #ffffff; letter-spacing: 1px; }
        .subtitle { font-size: 15px; margin-top: 10px; color: #fce4fc; font-style: italic; }
        .content { padding: 30px 25px; line-height: 1.6; }
        .greeting { font-size: 18px; font-weight: bold; color: #1f0b2b; margin-bottom: 15px; }
        .qr-box { text-align: center; background: #faf5fc; border: 2px dashed #f249e7; border-radius: 12px; padding: 20px; margin: 25px 0; }
        .code-badge { display: inline-block; background: #f249e7; color: #ffffff; padding: 8px 18px; border-radius: 30px; font-weight: bold; font-size: 16px; letter-spacing: 2px; margin-top: 10px; }
        .details-box { background: #fdf8fe; border-left: 4px solid #f249e7; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .notice-box { background: #fff2fc; border: 1px solid #f249e7; border-radius: 8px; padding: 14px; margin: 20px 0; color: #7a126e; text-align: center; font-weight: bold; }
        .calendar-btn-container { text-align: center; margin: 25px 0; }
        .btn-maps { display: inline-block; background: #f249e7; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 25px; font-weight: bold; font-size: 14px; margin-top: 10px; }
        .btn-cal { display: inline-block; background: #1f0b2b; color: #f3ca65 !important; text-decoration: none; padding: 12px 24px; border-radius: 25px; font-weight: bold; font-size: 14px; }
        .footer { background: #f6ecf7; padding: 20px; text-align: center; font-size: 12px; color: #777; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="gold-subtitle">Mis</div>
          <div class="gold-years">15 AÑOS</div>
          <h1 class="title">Sara Sofía Ortega Ayala</h1>
          <div class="subtitle">¡Tu asistencia está confirmada!</div>
        </div>

        <div class="content">
          <div class="greeting">¡Hola, ${leader.name}! &#127881;</div>
          <p>Nos llena de felicidad saber que nos acompañarás en esta noche mágica e inolvidable para Sara Sofía.</p>

          <div class="qr-box">
            <div style="font-size: 13px; color: #666; margin-bottom: 10px; text-transform: uppercase; font-weight: bold;">Tu Pase Digital de Acceso</div>
            <img src="${qrUrl}" alt="Pase QR" width="200" height="200" style="display: block; margin: 0 auto; border-radius: 8px;">
            <div class="code-badge">${leader.code}</div>
            <div style="font-size: 13px; color: #444; margin-top: 8px;">Puesto Asignado: <strong>#${leader.slot_number}</strong> de 90</div>
            <div style="font-size: 11px; color: #888; margin-top: 4px;">Presenta este código en tu celular al llegar al salón.</div>
          </div>

          ${companionsHtml}

          <div class="details-box">
            <h4 style="margin: 0 0 8px 0; color: #1f0b2b;">&#128197; Información del Evento:</h4>
            <p style="margin: 4px 0;"><strong>Fecha y Hora:</strong> ${EVENT_DATE}</p>
            <p style="margin: 4px 0;"><strong>Lugar:</strong> ${EVENT_VENUE}</p>
            <div style="text-align: center; margin-top: 12px;">
              <a href="${MAPS_URL}" target="_blank" class="btn-maps">&#128506;&#65039; Ver Ruta en Google Maps</a>
            </div>
          </div>

          <div class="notice-box">
            &#128087; DRESS CODE / CÓDIGO DE VESTIMENTA:<br>
            Traje Formal / De Gala.<br>
            <span style="font-size: 15px; color: #a40893;">&#9888;&#65039; IMPORTANTE: El color LILA está reservado exclusivamente para la quinceañera.</span>
          </div>

          <div class="calendar-btn-container">
            <p style="font-size: 13px; color: #555; margin-bottom: 10px;">¡No olvides agendarlo en tu Google Calendar!</p>
            <a target="_blank" href="${CALENDAR_URL}" class="btn-cal">
              📅 Agendar en Google Calendar
            </a>
          </div>
        </div>

        <div class="footer">
          <p style="margin: 4px 0;">Este mensaje fue enviado automáticamente para la celebración de los 15 de Sara Sofía Ortega Ayala.</p>
          <p style="margin: 4px 0;">Si por algún motivo no puedes asistir, por favor ingresa a la página web para liberar tu cupo a otro invitado.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  GmailApp.sendEmail(toEmail, `&#10024 [IMPORTANTE] ¡Asistencia Confirmada! Los 15 de Sara Sofía Ortega Ayala &#10024`, "", {
    htmlBody: htmlBody,
    name: "Los 15 de Sara Sofía",
    importance: "high"
  });
}

/**
 * Enviar enlace único para cancelar asistencia
 */
function sendCancelLinkEmail(email, name, cancelUrl) {
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #fdf6fe; padding: 20px; color: #1f0b2b; }
        .card { max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px 30px; box-shadow: 0 10px 30px rgba(242, 73, 231, 0.15); border-top: 6px solid #f249e7; text-align: center; }
        .title { color: #b515ab; font-size: 22px; font-weight: bold; margin-bottom: 10px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #f249e7 0%, #b515ab 100%); color: #ffffff !important; text-decoration: none; padding: 14px 30px; border-radius: 30px; font-weight: bold; font-size: 16px; margin: 25px 0; box-shadow: 0 4px 15px rgba(242, 73, 231, 0.4); }
        .footer { font-size: 12px; color: #888; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2 class="title">Verificación de Seguridad</h2>
        <p style="font-size: 16px;">Hola, <strong>${name}</strong>.</p>
        <p style="color: #444; line-height: 1.6;">Por motivos de seguridad, para proceder con la cancelación de tu asistencia a los 15 Años de Sara Sofía, puedes confirmar esta acción a través del siguiente enlace:</p>
        
        <a href="${cancelUrl}" class="btn">Gestionar y Cancelar Asistencia</a>
        
        <p style="color: #d63384; font-size: 14px; font-weight: bold;">Este enlace es único y personal.</p>
        
        <div class="footer">
          Si no solicitaste la cancelación, ignora este correo. Tu cupo sigue 100% asegurado en nuestro sistema.
        </div>
      </div>
    </body>
    </html>
  `;

  GmailApp.sendEmail(email, `&#9888 [Acción Requerida] Gestiona tu asistencia - Los 15 de Sara Sofía &#9888`, "", {
    htmlBody: htmlBody,
    name: "Los 15 de Sara Sofía",
    importance: "high"
  });
}

/**
 * Enviar correo informando que los cupos fueron cancelados exitosamente
 */
function sendCancellationConfirmedEmail(requester, releasedCount) {
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #fdf6fe; padding: 20px; color: #1f0b2b; }
        .card { max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border-top: 6px solid #e5c378; text-align: center; }
        .title { color: #8a6822; font-size: 22px; font-weight: bold; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2 class="title">Asistencia Cancelada Exitosamente</h2>
        <p style="font-size: 16px;">Hola, <strong>${requester.name}</strong>.</p>
        <p style="color: #555; line-height: 1.6;">
          Tu solicitud fue procesada exitosamente en la base de datos oficial. Se han liberado <strong>${releasedCount}</strong> puesto(s).
        </p>
        <div style="background: rgba(229, 195, 120, 0.15); border-radius: 12px; padding: 20px; margin: 25px 0;">
          <p style="margin: 0; color: #6b5314; font-size: 15px; font-style: italic;">
            "Nos habría encantado compartir esta noche mágica y soñada contigo, pero entendemos que a veces los planes cambian. ¡Te agradecemos de todo corazón por avisarnos a tiempo y permitir que otro invitado pueda ocupar tu lugar en la celebración!"
          </p>
        </div>
        <p style="color: #888; font-size: 13px;">Con cariño,<br><strong>Sara Sofía y su familia.</strong></p>
      </div>
    </body>
    </html>
  `;

  GmailApp.sendEmail(requester.email, `&#128363 [NOTIFICACIÓN] Asistencia Cancelada - Te extrañaremos en los 15 de Sara Sofía &#128363`, "", {
    htmlBody: htmlBody,
    name: "Los 15 de Sara Sofía",
    importance: "high"
  });
}

/**
 * Helper para respuestas JSON con encabezados CORS permisivos
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}