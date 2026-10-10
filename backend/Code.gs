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

// Configuración básica del repositorio
const GITHUB_OWNER = "MAOAZAking";
const GITHUB_REPO = "los-15-de-sara-sofia-ortega";
const GITHUB_BRANCH = "main";
const DB_FILE_PATH = "data/database.json";

// Configuración del evento
const EVENT_NAME = "Los 15 Años de Sara Sofía Ortega Ayala";
const EVENT_DATE = "Domingo, 20 de Diciembre de 2026 - 7:00 PM";
const EVENT_VENUE = "Cra. 23 # 56-50, Comuna 8, Cali, Valle del Cauca";
const MAPS_URL = "https://www.google.com/maps/dir//Cra.+23+%2356-50,+Comuna+8,+Cali,+Valle+del+Cauca/@3.4417114,-76.4965274,17z/data=!4m18!1m8!3m7!1s0x8e30a70733ebf565:0xc9f09c63545da21c!2sCra.+23+%2356-50,+Comuna+8,+Cali,+Valle+del+Cauca!3b1!8m2!3d3.4415515!4d-76.4965047!16s%2Fg%2F11vjm1vyjl!4m8!1m0!1m5!1m1!1s0x8e30a70733ebf565:0xc9f09c63545da21c!2m2!1d-76.4965047!2d3.4415515!3e0?entry=ttu";
const CALENDAR_URL = "https://calendar.google.com/calendar/event?action=TEMPLATE&tmeid=MmVrbnRqNjMxZ201a3RpcGNvMnExamJ2YnEgbWFvYXphMTM1NzlAbQ&tmsrc=maoaza13579%40gmail.com";
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

    return createJsonResponse({ error: "Acción no reconocida" });
  } catch (error) {
    return createJsonResponse({ error: error.toString() });
  }
}

/**
 * Manejo de peticiones POST (Registros, cancelaciones, commits y envíos de correo)
 */
function doPost(e) {
  if (action === "admin_login") {
    const validUser = PropertiesService.getScriptProperties().getProperty("ADMIN_USER");
    const validPass = PropertiesService.getScriptProperties().getProperty("ADMIN_PASS");
  
    if (payload.user === validUser && payload.pass === validPass) {
      return createJsonResponse({ success: true, token: "VIP_AUTH_GRANTED" });
    }
    return createJsonResponse({ success: false, error: "Credenciales inválidas" });
  }
  try {
    let payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      return createJsonResponse({ error: "Cuerpo de solicitud vacío" });
    }

    const action = payload.action;

    // 1. REGISTRAR ASISTENCIA Y COMITEAR
    if (action === "register") {
      const leader = payload.leader;
      const companions = payload.companions || [];
      const updatedDb = payload.database;
      const commitMessage = payload.commit_message || `Confirmación de asistencia: ${leader.name}`;

      // A. Realizar commit en GitHub
      let commitResult = null;
      try {
        commitResult = commitDatabaseToGitHub(updatedDb, commitMessage);
      } catch (err) {
        Logger.log("Error comiteando a GitHub: " + err);
      }

      // B. Enviar correo de confirmación desde maoaza13579@gmail.com
      sendConfirmationEmail(leader, companions);

      return createJsonResponse({
        success: true,
        commit: commitResult,
        email_sent_to: leader.email
      });
    }

    // 2. CANCELAR ASISTENCIA Y COMITEAR
    if (action === "cancel") {
      const requester = payload.requester;
      const releasedSlots = payload.released_slots || [];
      const updatedDb = payload.database;
      const commitMessage = payload.commit_message || `Cancelación de asistencia: ${requester.name}`;

      // A. Realizar commit en GitHub
      let commitResult = null;
      try {
        commitResult = commitDatabaseToGitHub(updatedDb, commitMessage);
      } catch (err) {
        Logger.log("Error comiteando a GitHub: " + err);
      }

      // B. Enviar correo confirmando liberación de cupos
      sendCancellationConfirmedEmail(requester, releasedSlots.length);

      return createJsonResponse({
        success: true,
        commit: commitResult,
        released: releasedSlots.length
      });
    }

    // 3. ENVIAR LINK DE CANCELACIÓN AL CORREO
    if (action === "send_cancel_email") {
      const email = payload.email;
      const name = payload.name;
      const cancelUrl = payload.cancel_url;

      sendCancelLinkEmail(email, name, cancelUrl);

      return createJsonResponse({
        success: true,
        sent_to: email
      });
    }

    // 4. CHECK-IN / INGRESO DE INVITADO
    if (action === "check_in") {
      const updatedDb = payload.database;
      const commitMessage = payload.commit_message || `Ingreso de invitado: ${payload.guest.name}`;

      let commitResult = null;
      try {
        commitResult = commitDatabaseToGitHub(updatedDb, commitMessage);
      } catch (err) {
        Logger.log("Error comiteando check-in: " + err);
      }

      return createJsonResponse({
        success: true,
        commit: commitResult
      });
    }

    return createJsonResponse({ error: "Acción POST no válida" });

  } catch (error) {
    Logger.log("Error en doPost: " + error.toString());
    return createJsonResponse({ error: error.toString() });
  }
}

/**
 * Obtener base de datos actual desde GitHub vía API REST
 */
function getDatabaseFromGitHub() {
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DB_FILE_PATH}?ref=${GITHUB_BRANCH}`;

  const headers = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Sara15-GAS-Backend"
  };
  if (token) {
    headers["Authorization"] = "token " + token;
  }

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: headers,
    muteHttpExceptions: true
  });

  if (response.getResponseCode() === 200) {
    const json = JSON.parse(response.getContentText());
    const decodedContent = Utilities.newBlob(Utilities.base64Decode(json.content)).getDataAsString("UTF-8");
    return JSON.parse(decodedContent);
  }

  throw new Error("No se pudo obtener el archivo de base de datos desde GitHub. Código: " + response.getResponseCode());
}

/**
 * Realizar commit directo en GitHub actualizando data/database.json
 */
function commitDatabaseToGitHub(databaseObj, message) {
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) {
    Logger.log("AVISO: GITHUB_TOKEN no configurado en ScriptProperties. No se realizó commit.");
    return { skipped: true, reason: "No GITHUB_TOKEN provided" };
  }

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DB_FILE_PATH}`;

  // 1. Obtener SHA actual del archivo
  const getFileRes = UrlFetchApp.fetch(url + `?ref=${GITHUB_BRANCH}`, {
    method: "get",
    headers: {
      "Authorization": "token " + token,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Sara15-GAS-Backend"
    },
    muteHttpExceptions: true
  });

  let sha = "";
  if (getFileRes.getResponseCode() === 200) {
    const fileInfo = JSON.parse(getFileRes.getContentText());
    sha = fileInfo.sha;
  }

  // 2. Codificar contenido en Base64
  const jsonString = JSON.stringify(databaseObj, null, 2);
  const base64Content = Utilities.base64Encode(Utilities.newBlob(jsonString).getBytes());

  // 3. Crear el commit vía PUT
  const commitPayload = {
    message: message,
    content: base64Content,
    branch: GITHUB_BRANCH
  };
  if (sha) {
    commitPayload.sha = sha;
  }

  const putRes = UrlFetchApp.fetch(url, {
    method: "put",
    headers: {
      "Authorization": "token " + token,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "Sara15-GAS-Backend"
    },
    payload: JSON.stringify(commitPayload),
    muteHttpExceptions: true
  });

  if (putRes.getResponseCode() === 200 || putRes.getResponseCode() === 201) {
    return JSON.parse(putRes.getContentText());
  } else {
    throw new Error("Fallo al comitear a GitHub: " + putRes.getContentText());
  }
}

/**
 * Enviar correo de confirmación de asistencia desde maoaza13579@gmail.com
 */
function sendConfirmationEmail(leader, companions) {
  const toEmail = leader.email;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(leader.code)}`;

  let companionsHtml = "";
  if (companions && companions.length > 0) {
    companionsHtml = `
      <div style="background: rgba(242, 73, 231, 0.08); border-radius: 8px; padding: 15px; margin: 15px 0;">
        <h4 style="margin: 0 0 10px 0; color: #f249e7; font-size: 15px;">👥 Acompañantes registrados contigo:</h4>
        <ul style="margin: 0; padding-left: 20px; color: #444;">
          ${companions.map(c => `<li><strong>${c.name}</strong> (Puesto #${c.slot_number} - Código: <code>${c.code}</code>)</li>`).join("")}
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
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f4fa; margin: 0; padding: 20px; color: #333; }
        .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid rgba(242, 73, 231, 0.2); }
        .header { background: linear-gradient(135deg, #1f0b2b 0%, #3e1047 100%); padding: 35px 20px; text-align: center; color: #ffffff; }
        .title { font-size: 26px; font-weight: bold; margin: 0; color: #f249e7; letter-spacing: 1px; }
        .subtitle { font-size: 16px; margin-top: 8px; color: #fce4fc; }
        .content { padding: 30px 25px; line-height: 1.6; }
        .greeting { font-size: 18px; font-weight: bold; color: #1f0b2b; margin-bottom: 15px; }
        .qr-box { text-align: center; background: #faf5fc; border: 2px dashed #f249e7; border-radius: 12px; padding: 20px; margin: 25px 0; }
        .code-badge { display: inline-block; background: #f249e7; color: #ffffff; padding: 8px 18px; border-radius: 30px; font-weight: bold; font-size: 16px; letter-spacing: 2px; margin-top: 10px; }
        .details-box { background: #fdf8fe; border-left: 4px solid #f249e7; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .notice-box { background: #fff2fc; border: 1px solid #f249e7; border-radius: 8px; padding: 14px; margin: 20px 0; color: #7a126e; text-align: center; font-weight: bold; }
        .calendar-btn-container { text-align: center; margin: 25px 0; }
        .btn-maps { display: inline-block; background: #f249e7; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 25px; font-weight: bold; font-size: 14px; margin-top: 10px; }
        .footer { background: #f6ecf7; padding: 20px; text-align: center; font-size: 12px; color: #777; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 3px; color: #f249e7; margin-bottom: 5px;">Mis Quince Años</div>
          <h1 class="title">Sara Sofía Ortega Ayala</h1>
          <div class="subtitle">¡Tu asistencia está confirmada!</div>
        </div>

        <div class="content">
          <div class="greeting">¡Hola, ${leader.name}! 🎉</div>
          <p>Nos llena de felicidad saber que nos acompañarás en esta noche mágica e inolvidable para Sara Sofía.</p>

          <div class="qr-box">
            <div style="font-size: 13px; color: #666; margin-bottom: 10px; text-transform: uppercase; font-weight: bold;">Tu Pase Digital de Acceso</div>
            <img src="${qrUrl}" alt="Pase QR" width="180" height="180" style="display: block; margin: 0 auto; border-radius: 8px;">
            <div class="code-badge">${leader.code}</div>
            <div style="font-size: 12px; color: #777; margin-top: 8px;">Puesto Asignado: <strong>#${leader.slot_number}</strong> de 90</div>
            <div style="font-size: 11px; color: #999; margin-top: 4px;">Presenta este código en tu celular al llegar a la fiesta.</div>
          </div>

          ${companionsHtml}

          <div class="details-box">
            <h4 style="margin: 0 0 8px 0; color: #1f0b2b;">📅 Información del Evento:</h4>
            <p style="margin: 4px 0;"><strong>Fecha y Hora:</strong> ${EVENT_DATE}</p>
            <p style="margin: 4px 0;"><strong>Lugar:</strong> ${EVENT_VENUE}</p>
            <div style="text-align: center; margin-top: 12px;">
              <a href="${MAPS_URL}" target="_blank" class="btn-maps">🗺️ Ver Ruta en Google Maps</a>
            </div>
          </div>

          <div class="notice-box">
            👗 DRESS CODE / CÓDIGO DE VESTIMENTA:<br>
            Traje Formal / De Gala.<br>
            <span style="font-size: 15px; color: #a40893;">⚠️ IMPORTANTE: El color morado está reservado exclusivamente para la quinceañera.</span>
          </div>

          <div class="calendar-btn-container">
            <p style="font-size: 13px; color: #555; margin-bottom: 10px;">¡No olvides agendarlo en tu Google Calendar!</p>
            <a target="_blank" href="${CALENDAR_URL}">
              <img border="0" src="https://calendar.google.com/calendar/images/ext/gc_button1_es-419.gif" alt="Guardar en Google Calendar">
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

  GmailApp.sendEmail(toEmail, `✨ ¡Asistencia Confirmada! Los 15 de Sara Sofía Ortega Ayala`, "", {
    htmlBody: htmlBody,
    name: "Los 15 de Sara Sofía"
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
        body { font-family: Arial, sans-serif; background: #fdf6fe; padding: 20px; color: #333; }
        .card { max-width: 550px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border-top: 5px solid #f249e7; }
        .btn { display: inline-block; background: #d63384; color: #fff !important; text-decoration: none; padding: 12px 25px; border-radius: 25px; font-weight: bold; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2 style="color: #1f0b2b; margin-top: 0;">Gestión de Asistencia - Los 15 de Sara Sofía</h2>
        <p>Hola, <strong>${name}</strong>.</p>
        <p>Hemos recibido una solicitud para cancelar tu confirmación de asistencia al evento.</p>
        <p>Para gestionar o confirmar la liberación de tu cupo (y el de tus acompañantes si eres líder de grupo), haz clic en el siguiente botón seguro:</p>
        <div style="text-align: center;">
          <a href="${cancelUrl}" class="btn">Cancelar Asistencia</a>
        </div>
        <p style="font-size: 12px; color: #777; margin-top: 25px;">Si no solicitaste esto, puedes ignorar este mensaje; tu asistencia permanecerá confirmada.</p>
      </div>
    </body>
    </html>
  `;

  GmailApp.sendEmail(email, `Enlace para gestionar o cancelar tu asistencia - Los 15 de Sara Sofía`, "", {
    htmlBody: htmlBody,
    name: "Los 15 de Sara Sofía"
  });
}

/**
 * Enviar correo informando que los cupos fueron cancelados exitosamente
 */
function sendCancellationConfirmedEmail(requester, releasedCount) {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h3 style="color: #1f0b2b;">Cancelación de Asistencia Procesada</h3>
      <p>Hola, <strong>${requester.name}</strong>.</p>
      <p>Te confirmamos que se ha procesado tu solicitud de cancelación. Se han liberado <strong>${releasedCount}</strong> puesto(s) para que otros invitados puedan asistir.</p>
      <p>¡Lamentamos mucho que no puedas acompañarnos, gracias por informarnos a tiempo!</p>
    </div>
  `;

  GmailApp.sendEmail(requester.email, `Cancelación de Asistencia Confirmada - Los 15 de Sara Sofía`, "", {
    htmlBody: htmlBody,
    name: "Los 15 de Sara Sofía"
  });
}

/**
 * Helper para respuestas JSON
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
