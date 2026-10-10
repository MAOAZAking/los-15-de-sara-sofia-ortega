/**
 * CONFIGURACIÓN GENERAL - LOS 15 DE SARA SOFÍA ORTEGA AYALA
 * Todos los parámetros centrales de la aplicación web y repositorio
 */

const CONFIG = {
  // Datos del Evento
  EVENT: {
    QUINCEANERA: "Sara Sofía Ortega Ayala",
    DATE_STR: "20 de Diciembre de 2026",
    DATE_ISO: "2026-12-20T19:00:00-05:00", // 7:00 PM hora Colombia
    YEAR: 2026,
    MONTH: 11, // Diciembre (0-indexed en JS)
    DAY: 20,
    HOUR: 19,
    MINUTE: 0,
    MAX_CAPACITY: 90,
    PRIMARY_COLOR_RGB: "rgb(242, 73, 231)",
    PRIMARY_COLOR_HEX: "#F249E7",
    RESERVED_COLOR: "Morado", // Reservado exclusivamente para la quinceañera
    VENUE_NAME: "Recepción de Eventos",
    VENUE_ADDRESS: "Cra. 23 # 56-50, Comuna 8, Cali, Valle del Cauca",
    GOOGLE_MAPS_URL: "https://www.google.com/maps/dir//Cra.+23+%2356-50,+Comuna+8,+Cali,+Valle+del+Cauca/@3.4417114,-76.4965274,17z/data=!4m18!1m8!3m7!1s0x8e30a70733ebf565:0xc9f09c63545da21c!2sCra.+23+%2356-50,+Comuna+8,+Cali,+Valle+del+Cauca!3b1!8m2!3d3.4415515!4d-76.4965047!16s%2Fg%2F11vjm1vyjl!4m8!1m0!1m5!1m1!1s0x8e30a70733ebf565:0xc9f09c63545da21c!2m2!1d-76.4965047!2d3.4415515!3e0?entry=ttu",
    GOOGLE_CALENDAR_URL: "https://calendar.google.com/calendar/event?action=TEMPLATE&tmeid=MmVrbnRqNjMxZ201a3RpcGNvMnExamJ2YnEgbWFvYXphMTM1NzlAbQ&tmsrc=maoaza13579%40gmail.com",
    ORGANIZER_EMAIL: "maoaza13579@gmail.com"
  },

  // Persistencia y Cookies
  COOKIE: {
    NAME: "sara15_asistencia_pass",
    // Cookie obligatoria hasta el 21 de Diciembre del 2026
    EXPIRES_UTC: "Mon, 21 Dec 2026 23:59:59 GMT",
    EXPIRY_TIMESTAMP: new Date("2026-12-21T23:59:59Z").getTime()
  },

  // Configuración de GitHub y Backend
  GITHUB: {
    REPO_OWNER: "MAOAZAking",
    REPO_NAME: "los-15-de-sara-sofia-ortega",
    BRANCH: "main",
    DB_FILE_PATH: "data/database.json",
    RAW_DB_URL: "https://raw.githubusercontent.com/MAOAZAking/los-15-de-sara-sofia-ortega/main/data/database.json"
  },

  // Backend URL (Google Apps Script Web App desplegada con tu correo maoaza13579@gmail.com)
  // Al desplegar tu Google Apps Script, pega la URL generada aquí.
  // Mientras esté vacía o en desarrollo local, el sistema usa el modo híbrido con persistencia local y sincronización.
  BACKEND_API_URL: "https://script.google.com/macros/s/AKfycbz0yLF4VzJm_4wJcR9yuA20VI-SXAGRsglQiVL5PGrVbwYN9ua-hhvuxlHJPv3Eu0F4/exec", 

  // 1_ARQUITECTURA_DE_SEGURIDAD_OBSCURA: 
  // Credenciales eliminadas del cliente. La autenticación es 100% Serverless.

  // Frase estricta para confirmación de cancelación
  CANCEL_SECURITY_PHRASE: "CANCELAR asistencia"
};

// Exportar globalmente
window.APP_CONFIG = CONFIG;

// Inyección automática de favicon en todas las páginas
(function() {
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/png'; // Cambia a 'image/x-icon' si usas .ico o 'image/svg+xml' si es .svg
    favicon.href = 'img/icono.png'; // Reemplaza con la ruta real de tu imagen
    document.head.appendChild(favicon);
})();