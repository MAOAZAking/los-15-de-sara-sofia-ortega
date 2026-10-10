/**
 * SERVICIO DE BASE DE DATOS Y GESTIÓN DE ACCIONES (DB SERVICE)
 * Maneja la sincronización con GitHub (via Google Apps Script o API directa)
 * y la persistencia de cookies hasta el 21 de diciembre del 2026.
 */

class DatabaseService {
  constructor() {
    this.config = window.APP_CONFIG;
    this.localCacheKey = "sara15_db_cache";
  }

  // ==========================================
  // MANEJO DE COOKIES (HASTA 21 DIC 2026)
  // ==========================================

  setAttendanceCookie(guestData) {
    try {
      const dataStr = encodeURIComponent(JSON.stringify(guestData));
      // Cookie que expira obligatoriamente el 21 de Diciembre del 2026
      const cookieStr = `${this.config.COOKIE.NAME}=${dataStr}; expires=${this.config.COOKIE.EXPIRES_UTC}; path=/; SameSite=Lax`;
      document.cookie = cookieStr;
      // Respaldo en localStorage por compatibilidad móvil estricta
      localStorage.setItem(this.config.COOKIE.NAME, JSON.stringify(guestData));
      return true;
    } catch (e) {
      console.error("Error guardando cookie:", e);
      return false;
    }
  }

  getAttendanceCookie() {
    try {
      const name = this.config.COOKIE.NAME + "=";
      const decodedCookie = decodeURIComponent(document.cookie);
      const ca = decodedCookie.split(";");
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(name) === 0) {
          const jsonStr = decodeURIComponent(c.substring(name.length, c.length));
          return JSON.parse(jsonStr);
        }
      }
      // Si la cookie no está (o navegador bloquea cookies de terceros), verificar respaldo
      const localBackup = localStorage.getItem(this.config.COOKIE.NAME);
      if (localBackup) {
        return JSON.parse(localBackup);
      }
      return null;
    } catch (e) {
      console.warn("No se pudo leer la cookie de asistencia:", e);
      const localBackup = localStorage.getItem(this.config.COOKIE.NAME);
      return localBackup ? JSON.parse(localBackup) : null;
    }
  }

  deleteAttendanceCookie() {
    document.cookie = `${this.config.COOKIE.NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
    localStorage.removeItem(this.config.COOKIE.NAME);
  }

  // ==========================================
  // CONSULTA Y CARGA DE BASE DE DATOS
  // ==========================================

  async fetchDatabase() {
    // 1. Si hay una URL de Google Apps Script configurada, intentamos consultar el backend
    if (this.config.BACKEND_API_URL && this.config.BACKEND_API_URL.startsWith("http")) {
      try {
        const response = await fetch(`${this.config.BACKEND_API_URL}?action=get_db&t=${Date.now()}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.slots) {
            this.saveLocalCache(data);
            return data;
          }
        }
      } catch (err) {
        console.warn("Fallo al conectar con Google Apps Script, intentando respaldo...", err);
      }
    }

    // 2. Intentamos consultar el archivo JSON en GitHub Raw con cache-buster
    try {
      const rawUrl = `${this.config.GITHUB.RAW_DB_URL}?nocache=${Date.now()}`;
      const response = await fetch(rawUrl);
      if (response.ok) {
        const data = await response.json();
        if (data && data.slots) {
          this.saveLocalCache(data);
          return data;
        }
      }
    } catch (e) {
      console.warn("No se pudo obtener data de GitHub Raw:", e);
    }

    // 3. Intentamos consultar el archivo local relativo data/database.json
    try {
      const response = await fetch(`data/database.json?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.slots) {
          this.saveLocalCache(data);
          return data;
        }
      }
    } catch (e) {
      console.warn("No se pudo obtener data/database.json local:", e);
    }

    // 4. Respaldo en caché local del navegador
    const cached = this.getLocalCache();
    if (cached && cached.slots) {
      return cached;
    }

    // 5. Inicialización predeterminada de 90 puestos vacíos si no hay nada
    return this.generateDefaultDatabase();
  }

  generateDefaultDatabase() {
    const slots = [];
    for (let i = 1; i <= 90; i++) {
      slots.push({
        slot: i,
        guest: null
      });
    }
    const defaultDb = {
      event_info: {
        title: "Los 15 de Sara Sofía Ortega Ayala",
        quinceanera: this.config.EVENT.QUINCEANERA,
        date: this.config.EVENT.DATE_STR,
        time: "7:00 PM",
        venue: this.config.EVENT.VENUE_ADDRESS,
        max_capacity: 90,
        primary_color: this.config.EVENT.PRIMARY_COLOR_RGB,
        reserved_color: this.config.EVENT.RESERVED_COLOR
      },
      slots: slots,
      temporary_locks: [],
      all_time_guests: []
    };
    this.saveLocalCache(defaultDb);
    return defaultDb;
  }

  getLocalCache() {
    try {
      const str = localStorage.getItem(this.localCacheKey);
      return str ? JSON.parse(str) : null;
    } catch (e) {
      return null;
    }
  }

  saveLocalCache(db) {
    try {
      localStorage.setItem(this.localCacheKey, JSON.stringify(db));
    } catch (e) {
      console.warn("Error guardando caché local:", e);
    }
  }

  // ==========================================
  // CÁLCULO DE VACANTES Y CUPOS
  // ==========================================

  calculateVacancies(db) {
    if (!db || !db.slots) return { available: 0, occupied: 0, total: 90 };
    
    const now = Date.now();
    // Limpiar bloqueos temporales expirados (más de 10 minutos)
    const validLocks = (db.temporary_locks || []).filter(lock => lock.expires_at > now);

    let occupied = 0;
    for (const slot of db.slots) {
      if (slot.guest !== null) {
        occupied++;
      }
    }

    const lockedCount = validLocks.length;
    const totalOccupiedOrLocked = occupied + lockedCount;
    const available = Math.max(0, 90 - totalOccupiedOrLocked);

    return {
      available: available,
      occupied: occupied,
      locked: lockedCount,
      total: 90
    };
  }

  async getVacanciesCount() {
    const db = await this.fetchDatabase();
    return this.calculateVacancies(db);
  }

  // ==========================================
  // BLOQUEO TEMPORAL DE CUPO MIENTRAS DILIGENCIA
  // ==========================================

  async lockSlotTemporarily(lockId) {
    // Si hay backend configurado, notificamos
    if (this.config.BACKEND_API_URL && this.config.BACKEND_API_URL.startsWith("http")) {
      try {
        await fetch(this.config.BACKEND_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            action: "temp_lock",
            lock_id: lockId
          })
        });
      } catch (e) {
        console.warn("Fallo al bloquear cupo en backend:", e);
      }
    }

    // Registrar también localmente
    const db = await this.fetchDatabase();
    if (!db.temporary_locks) db.temporary_locks = [];
    // Limpiar expirados
    const now = Date.now();
    db.temporary_locks = db.temporary_locks.filter(l => l.expires_at > now && l.lock_id !== lockId);
    // Agregar nuevo bloqueo (expira en 10 minutos = 600000 ms)
    db.temporary_locks.push({
      lock_id: lockId,
      expires_at: now + 600000
    });
    this.saveLocalCache(db);
  }

  async releaseTemporaryLock(lockId) {
    if (this.config.BACKEND_API_URL && this.config.BACKEND_API_URL.startsWith("http")) {
      try {
        await fetch(this.config.BACKEND_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            action: "release_temp_lock",
            lock_id: lockId
          })
        });
      } catch (e) {}
    }

    const db = await this.fetchDatabase();
    if (db.temporary_locks) {
      db.temporary_locks = db.temporary_locks.filter(l => l.lock_id !== lockId);
      this.saveLocalCache(db);
    }
  }

  // ==========================================
  // GENERACIÓN DE CÓDIGO ÚNICO DE INVITADO
  // ==========================================

  generateUniqueCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "SARA15-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // ==========================================
  // VERIFICACIÓN DE HISTORIAL (LÍDER REGRESANDO)
  // ==========================================

  async checkPreviousRegistration(documentNumber) {
    const db = await this.fetchDatabase();
    if (!db.all_time_guests || db.all_time_guests.length === 0) return null;

    // Buscar si ya estuvo registrado como líder
    const previous = db.all_time_guests.find(
      g => g.document === documentNumber && g.is_leader === true
    );
    if (!previous) return null;

    // Buscar los acompañantes que tuvo asociados en ese mismo grupo
    const groupCompanions = db.all_time_guests.filter(
      g => g.group_id === previous.group_id && g.document !== documentNumber
    );

    return {
      leader: previous,
      companions: groupCompanions,
      totalGroupSize: 1 + groupCompanions.length
    };
  }

  // ==========================================
  // REGISTRO DE ASISTENCIA (LÍDER Y ACOMPAÑANTES)
  // ==========================================

  async registerGuest(leaderData, companions = [], tempLockId = null) {
    const totalPeople = 1 + companions.length;
    const db = await this.fetchDatabase();
    const stats = this.calculateVacancies(db);

    // Validar si hay cupo suficiente
    if (stats.available < totalPeople) {
      throw new Error(`Solo quedan ${stats.available} cupos disponibles.`);
    }

    // Validar que el documento del líder o acompañantes no esté actualmente activo
    const activeDocs = new Set();
    db.slots.forEach(s => {
      if (s.guest && s.guest.document) {
        activeDocs.add(s.guest.document.toString().trim());
      }
    });

    if (activeDocs.has(leaderData.document.toString().trim())) {
      throw new Error(`El documento ${leaderData.document} ya tiene una asistencia activa confirmada.`);
    }

    for (const comp of companions) {
      if (activeDocs.has(comp.document.toString().trim())) {
        throw new Error(`El documento ${comp.document} de acompañante ya está registrado.`);
      }
    }

    // Buscar puestos vacíos en slots (1 al 90)
    const availableSlotIndices = [];
    for (let i = 0; i < db.slots.length; i++) {
      if (db.slots[i].guest === null) {
        availableSlotIndices.push(i);
        if (availableSlotIndices.length === totalPeople) break;
      }
    }

    if (availableSlotIndices.length < totalPeople) {
      throw new Error("No se encontraron suficientes puestos vacíos consecutivos.");
    }

    const groupId = "GRP-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).substring(2, 5).toUpperCase();
    const registrationTimestamp = new Date().toISOString();

    // 1. Asignar líder
    const leaderSlotIndex = availableSlotIndices[0];
    const leaderCode = this.generateUniqueCode();
    const leaderGuest = {
      code: leaderCode,
      name: leaderData.name.trim(),
      document: leaderData.document.toString().trim(),
      email: leaderData.email.trim(),
      is_leader: true,
      group_id: groupId,
      leader_name: leaderData.name.trim(),
      leader_document: leaderData.document.toString().trim(),
      registered_at: registrationTimestamp,
      slot_number: leaderSlotIndex + 1,
      checked_in: false,
      checked_in_at: null
    };

    db.slots[leaderSlotIndex].guest = leaderGuest;

    // 2. Asignar acompañantes
    const registeredCompanions = [];
    for (let c = 0; c < companions.length; c++) {
      const compSlotIndex = availableSlotIndices[c + 1];
      const compData = companions[c];
      const compCode = this.generateUniqueCode();
      const compGuest = {
        code: compCode,
        name: compData.name.trim(),
        document: compData.document.toString().trim(),
        email: compData.email.trim() || leaderData.email.trim(),
        is_leader: false,
        group_id: groupId,
        leader_name: leaderData.name.trim(),
        leader_document: leaderData.document.toString().trim(),
        registered_at: registrationTimestamp,
        slot_number: compSlotIndex + 1,
        checked_in: false,
        checked_in_at: null
      };

      db.slots[compSlotIndex].guest = compGuest;
      registeredCompanions.push(compGuest);
    }

    // 3. Registrar en historial permanente (all_time_guests)
    if (!db.all_time_guests) db.all_time_guests = [];
    
    const leaderHistoryRecord = {
      ...leaderGuest,
      status: "active",
      companions_registered: registeredCompanions.map(c => ({
        name: c.name,
        document: c.document,
        email: c.email,
        code: c.code
      }))
    };
    db.all_time_guests.push(leaderHistoryRecord);

    for (const comp of registeredCompanions) {
      db.all_time_guests.push({
        ...comp,
        status: "active"
      });
    }

    // Limpiar bloqueo temporal si existía
    if (tempLockId && db.temporary_locks) {
      db.temporary_locks = db.temporary_locks.filter(l => l.lock_id !== tempLockId);
    }

    // Guardar en caché local
    this.saveLocalCache(db);

    // Guardar Cookie en el dispositivo (obligatoria hasta el 21 Dic 2026)
    const cookiePayload = {
      code: leaderGuest.code,
      name: leaderGuest.name,
      document: leaderGuest.document,
      email: leaderGuest.email,
      slot_number: leaderGuest.slot_number,
      group_id: leaderGuest.group_id,
      is_leader: true,
      registered_at: registrationTimestamp,
      companions: registeredCompanions.map(c => ({
        code: c.code,
        name: c.name,
        document: c.document,
        slot_number: c.slot_number
      }))
    };
    this.setAttendanceCookie(cookiePayload);

    // 4. Enviar a Backend / GitHub para comitear y enviar correos desde maoaza13579@gmail.com
    const commitMessage = `Confirmación de asistencia: ${leaderGuest.name} (${totalPeople} puesto/s: #${leaderGuest.slot_number}${registeredCompanions.length > 0 ? ', #' + registeredCompanions.map(c => c.slot_number).join(', #') : ''})`;

    if (this.config.BACKEND_API_URL && this.config.BACKEND_API_URL.startsWith("http")) {
      try {
        await fetch(this.config.BACKEND_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            action: "register",
            commit_message: commitMessage,
            leader: leaderGuest,
            companions: registeredCompanions,
            database: db
          })
        });
      } catch (err) {
        console.warn("Backend falló al comitear o enviar correo (los datos quedaron en memoria local):", err);
      }
    }

    return {
      success: true,
      leader: leaderGuest,
      companions: registeredCompanions,
      totalRegistered: totalPeople,
      cookieData: cookiePayload
    };
  }

  // ==========================================
  // CANCELACIÓN DE ASISTENCIA
  // ==========================================

  async cancelAttendance(documentOrCode, options = { cancelAllGroup: false, specificCodes: null }) {
    const db = await this.fetchDatabase();
    
    // Buscar los puestos a cancelar
    let targetSlots = [];
    let requesterGuest = null;

    for (const s of db.slots) {
      if (s.guest) {
        if (s.guest.document === documentOrCode || s.guest.code === documentOrCode) {
          requesterGuest = s.guest;
          break;
        }
      }
    }

    if (!requesterGuest) {
      // Buscar en all_time_guests por si ya fue cancelado
      const wasEver = (db.all_time_guests || []).find(g => g.document === documentOrCode || g.code === documentOrCode);
      if (wasEver) {
        throw new Error("Esta asistencia ya no se encuentra activa en los puestos oficiales.");
      }
      throw new Error("No se encontró ningún registro activo con los datos proporcionados.");
    }

    const cancellationTime = new Date().toISOString();
    const codesToCancel = new Set();

    if (requesterGuest.is_leader) {
      if (options.cancelAllGroup) {
        // Cancelar a todos los miembros de su grupo
        db.slots.forEach(s => {
          if (s.guest && s.guest.group_id === requesterGuest.group_id) {
            codesToCancel.add(s.guest.code);
          }
        });
      } else if (Array.isArray(options.specificCodes) && options.specificCodes.length > 0) {
        // Cancelar líder + específicos
        codesToCancel.add(requesterGuest.code);
        options.specificCodes.forEach(c => codesToCancel.add(c));
      } else {
        // Solo cancelar al líder
        codesToCancel.add(requesterGuest.code);
      }
    } else {
      // Un acompañante solo puede cancelarse a sí mismo
      codesToCancel.add(requesterGuest.code);
    }

    // Liberar puestos en slots (dejar en blanco: guest = null)
    let releasedSlots = [];
    db.slots.forEach(s => {
      if (s.guest && codesToCancel.has(s.guest.code)) {
        releasedSlots.push({
          slot: s.slot,
          guest_name: s.guest.name,
          guest_code: s.guest.code
        });
        s.guest = null; // ¡Puesto destruido y liberado!
      }
    });

    // Actualizar historial all_time_guests: no se borra, se marca como cancelled
    if (db.all_time_guests) {
      db.all_time_guests.forEach(g => {
        if (codesToCancel.has(g.code)) {
          g.status = "cancelled";
          g.cancelled_at = cancellationTime;
        }
      });
    }

    // Si el usuario actual tiene la cookie de este registro, eliminar la cookie
    const currentCookie = this.getAttendanceCookie();
    if (currentCookie && (codesToCancel.has(currentCookie.code) || currentCookie.document === requesterGuest.document)) {
      this.deleteAttendanceCookie();
    }

    this.saveLocalCache(db);

    // Enviar commit a GitHub via backend
    const commitMessage = `Cancelación de asistencia: ${requesterGuest.name} liberó ${releasedSlots.length} puesto/s (#${releasedSlots.map(r => r.slot).join(', #')})`;
    
    if (this.config.BACKEND_API_URL && this.config.BACKEND_API_URL.startsWith("http")) {
      try {
        await fetch(this.config.BACKEND_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            action: "cancel",
            commit_message: commitMessage,
            requester: requesterGuest,
            released_slots: releasedSlots,
            database: db
          })
        });
      } catch (e) {
        console.warn("Fallo al enviar cancelación al backend:", e);
      }
    }

    return {
      success: true,
      releasedCount: releasedSlots.length,
      releasedSlots: releasedSlots,
      requester: requesterGuest
    };
  }

  // ==========================================
  // ENVÍO DE LINK DE CANCELACIÓN AL CORREO
  // ==========================================

  async requestCancelLink(documentNumber) {
    const db = await this.fetchDatabase();
    let guestFound = null;

    for (const s of db.slots) {
      if (s.guest && s.guest.document === documentNumber.toString().trim()) {
        guestFound = s.guest;
        break;
      }
    }

    if (!guestFound) {
      throw new Error("No existe ninguna confirmación de asistencia activa con este número de documento.");
    }

    // Generar token de cancelación y enlace
    const cancelToken = btoa(JSON.stringify({
      code: guestFound.code,
      doc: guestFound.document,
      created: Date.now()
    }));

    const cancelUrl = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}cancel.html?token=${encodeURIComponent(cancelToken)}&doc=${encodeURIComponent(guestFound.document)}`;

    // Si hay backend configurado, enviar correo real desde maoaza13579@gmail.com
    if (this.config.BACKEND_API_URL && this.config.BACKEND_API_URL.startsWith("http")) {
      try {
        const res = await fetch(this.config.BACKEND_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            action: "send_cancel_email",
            email: guestFound.email,
            name: guestFound.name,
            document: guestFound.document,
            cancel_url: cancelUrl
          })
        });
        const result = await res.json();
        return { success: true, email: guestFound.email, cancelUrl: cancelUrl, backend: true };
      } catch (e) {
        console.warn("Fallo al enviar correo desde backend:", e);
      }
    }

    // Modo simulación / local
    return {
      success: true,
      email: guestFound.email,
      cancelUrl: cancelUrl,
      simulated: true
    };
  }

  // ==========================================
  // CHECK-IN / INGRESO DE INVITADO (ADMIN DASHBOARD)
  // ==========================================

  async checkInGuest(code) {
    const cleanCode = (code || "").trim().toUpperCase();
    const db = await this.fetchDatabase();

    let targetSlot = null;
    for (const s of db.slots) {
      if (s.guest && s.guest.code && s.guest.code.toUpperCase() === cleanCode) {
        targetSlot = s;
        break;
      }
    }

    if (!targetSlot || !targetSlot.guest) {
      return {
        success: false,
        reason: "not_found",
        message: "El código no corresponde a ningún cupo activo actualmente."
      };
    }

    if (targetSlot.guest.checked_in) {
      return {
        success: false,
        reason: "already_checked_in",
        guest: targetSlot.guest,
        message: `El invitado ${targetSlot.guest.name} ya ingresó previamente a las ${new Date(targetSlot.guest.checked_in_at).toLocaleTimeString()}.`
      };
    }

    // Marcar como ingresado
    const nowIso = new Date().toISOString();
    targetSlot.guest.checked_in = true;
    targetSlot.guest.checked_in_at = nowIso;

    // Actualizar también en historial all_time_guests
    if (db.all_time_guests) {
      const hist = db.all_time_guests.find(g => g.code === cleanCode);
      if (hist) {
        hist.checked_in = true;
        hist.checked_in_at = nowIso;
      }
    }

    this.saveLocalCache(db);

    // Notificar al backend / GitHub commit
    const commitMessage = `Ingreso al evento: ${targetSlot.guest.name} (Puesto #${targetSlot.slot})`;
    if (this.config.BACKEND_API_URL && this.config.BACKEND_API_URL.startsWith("http")) {
      try {
        await fetch(this.config.BACKEND_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            action: "check_in",
            commit_message: commitMessage,
            code: cleanCode,
            guest: targetSlot.guest,
            database: db
          })
        });
      } catch (e) {
        console.warn("Fallo al sincronizar check-in con backend:", e);
      }
    }

    return {
      success: true,
      guest: targetSlot.guest,
      slot: targetSlot.slot
    };
  }

  // ==========================================
  // CONSULTA DE DETALLES DE GRUPO PARA CANCELACIÓN
  // ==========================================

  async getGroupDetailsForCancellation(identifier) {
    const db = await this.fetchDatabase();
    let guest = null;

    for (const s of db.slots) {
      if (s.guest && (s.guest.document === identifier || s.guest.code === identifier)) {
        guest = s.guest;
        break;
      }
    }

    if (!guest) return null;

    // Si es líder, buscar todos sus acompañantes activos
    let companions = [];
    if (guest.is_leader) {
      db.slots.forEach(s => {
        if (s.guest && s.guest.group_id === guest.group_id && s.guest.code !== guest.code) {
          companions.push(s.guest);
        }
      });
    }

    return {
      guest: guest,
      isLeader: guest.is_leader,
      companions: companions,
      totalInGroup: 1 + companions.length
    };
  }
}

// Exportar instancia global
window.dbService = new DatabaseService();
