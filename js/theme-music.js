/**
 * ==========================================================================
 * THEME-MUSIC.JS - CONTROLADOR GLOBAL DE MÚSICA, TEMA Y AVISOS VISUALES
 * Integrado en todas las páginas (index.html, admin.html, cancel.html)
 * ==========================================================================
 */

(function () {
  const LIGHT_THEME_ID = "global-light-theme-link";
  const AUDIO_SRC_PRIMARY = "assets/audio/sonido-fondo-15-sara.mp3";
  const AUDIO_SRC_CDN = "https://cdn.pixabay.com/audio/2022/03/09/audio_1a0cac8819.mp3";

  // Inyectar estilos indispensables para animaciones de giro 360 y notificaciones
  const styleEl = document.createElement("style");
  styleEl.id = "global-theme-music-styles";
  styleEl.textContent = `
    @keyframes spin360Keyframes {
      0% { transform: rotate(0deg) scale(0.9); }
      50% { transform: rotate(180deg) scale(1.18); }
      100% { transform: rotate(360deg) scale(1); }
    }
    .spin-active {
      animation: spin360Keyframes 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }
    .btn-floating-control,
    .btn-music-toggle,
    #music-toggle-btn,
    #theme-toggle-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      cursor: pointer;
      border: 1.5px solid #F249E7;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
      user-select: none;
      -webkit-user-select: none;
      outline: none;
    }
    .floating-controls {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* BANNER FLOTANTE SUPERIOR (SIN ALERT JAVASCRIPT) */
    .top-notice-banner {
      position: fixed;
      top: 18px;
      left: 50%;
      transform: translateX(-50%) translateY(-120px);
      z-index: 1000000;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 24px;
      border-radius: 30px;
      font-family: 'Montserrat', sans-serif, system-ui;
      font-size: 14px;
      font-weight: 600;
      color: #ffffff;
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
      opacity: 0;
      pointer-events: none;
      max-width: 92vw;
      text-align: center;
    }
    .top-notice-banner.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
      pointer-events: auto;
    }
    .top-notice-banner.loading {
      background: rgba(28, 6, 42, 0.94);
      border: 1.5px solid #f249e7;
      color: #fff4fc;
      box-shadow: 0 0 25px rgba(242, 73, 231, 0.4);
    }
    .top-notice-banner.success {
      background: rgba(14, 52, 28, 0.94);
      border: 1.5px solid #2ecc71;
      color: #edfff4;
      box-shadow: 0 0 25px rgba(46, 204, 113, 0.4);
    }
    .top-notice-banner.error {
      background: rgba(58, 12, 20, 0.95);
      border: 1.5px solid #e74c3c;
      color: #ffeded;
      box-shadow: 0 0 25px rgba(231, 76, 60, 0.4);
    }
    .top-notice-banner.warning {
      background: rgba(56, 38, 10, 0.95);
      border: 1.5px solid #f39c12;
      color: #fff9ea;
      box-shadow: 0 0 25px rgba(243, 156, 18, 0.4);
    }
    .top-notice-banner.info {
      background: rgba(21, 60, 178, 0.26);
      border: 1.5px solid #3498db;
      color: #edf5ff;
      box-shadow: 0 0 25px rgba(52, 152, 219, 0.4);
    }
    .top-notice-spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid rgba(255, 255, 255, 0.25);
      border-top-color: #f249e7;
      border-radius: 50%;
      animation: noticeSpinKeyframes 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes noticeSpinKeyframes {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleEl);

  // ==========================================
  // ELEMENTOS DE AUDIO Y BANNER
  // ==========================================
  let audioElement = null;
  let topBannerEl = null;
  let bannerTimer = null;

  function initAudioElement() {
    if (!audioElement) {
      audioElement = document.getElementById("global-bg-audio");
      if (!audioElement) {
        audioElement = document.createElement("audio");
        audioElement.id = "global-bg-audio";
        audioElement.loop = true;
        audioElement.preload = "auto";

        const srcLocal = document.createElement("source");
        srcLocal.src = AUDIO_SRC_PRIMARY;
        srcLocal.type = "audio/mpeg";

        const srcCdn = document.createElement("source");
        srcCdn.src = AUDIO_SRC_CDN;
        srcCdn.type = "audio/mpeg";

        audioElement.appendChild(srcLocal);
        audioElement.appendChild(srcCdn);
        document.body.appendChild(audioElement);
      }
    }
    return audioElement;
  }

  function initTopBanner() {
    if (!topBannerEl) {
      topBannerEl = document.createElement("div");
      topBannerEl.className = "top-notice-banner";
      topBannerEl.innerHTML = `<span class="top-notice-icon">ℹ️</span><span class="top-notice-text"></span>`;
      document.body.appendChild(topBannerEl);
    }
    return topBannerEl;
  }

  // Helper global para mostrar aviso superior
  window.showTopNotice = function (message, type = "info", duration = 4000) {
    const banner = initTopBanner();
    if (!banner) return;

    if (bannerTimer) {
      clearTimeout(bannerTimer);
      bannerTimer = null;
    }

    banner.className = `top-notice-banner ${type} show`;
    const iconEl = banner.querySelector(".top-notice-icon");
    const textEl = banner.querySelector(".top-notice-text");

    if (type === "loading") {
      iconEl.innerHTML = `<div class="top-notice-spinner"></div>`;
    } else if (type === "success") {
      iconEl.innerHTML = `✅`;
    } else if (type === "error") {
      iconEl.innerHTML = `❌`;
    } else if (type === "warning") {
      iconEl.innerHTML = `⚠️`;
    } else {
      iconEl.innerHTML = `ℹ️`;
    }

    textEl.textContent = message;

    if (type !== "loading" && duration > 0) {
      bannerTimer = setTimeout(() => {
        window.hideTopNotice();
      }, duration);
    }
  };

  window.hideTopNotice = function () {
    if (topBannerEl) {
      topBannerEl.classList.remove("show");
    }
    if (bannerTimer) {
      clearTimeout(bannerTimer);
      bannerTimer = null;
    }
  };

  // Reemplazar window.alert por showTopNotice para no congelar la UX
  window.nativeAlert = window.alert;
  window.alert = function (msg) {
    window.showTopNotice(msg, "warning", 5000);
  };

  // ==========================================
  // INICIALIZACIÓN DE BOTONES FLOTANTES
  // ==========================================
  function ensureFloatingControls() {
    let container = document.querySelector(".floating-controls");
    if (!container) {
      container = document.createElement("div");
      container.className = "floating-controls";
      container.innerHTML = `
        <button type="button" class="btn-floating-control" id="music-toggle-btn" title="Activar música">🔇</button>
        <button type="button" class="btn-floating-control" id="theme-toggle-btn" title="Cambiar tema">☀️</button>
      `;
      document.body.appendChild(container);
    }

    const musicBtn = document.getElementById("music-toggle-btn");
    const themeBtn = document.getElementById("theme-toggle-btn");

    // Configurar estado del tema
    applyThemePreference(themeBtn, false);

    // Evento de clic en Tema (Giro 360)
    if (themeBtn && !themeBtn.hasAttribute("data-theme-listener")) {
      themeBtn.setAttribute("data-theme-listener", "true");
      themeBtn.addEventListener("click", () => {
        triggerSpin(themeBtn);
        const current = localStorage.getItem("sara15_theme") || "light";
        const next = current === "light" ? "dark" : "light";
        localStorage.setItem("sara15_theme", next);
        applyThemePreference(themeBtn, true);
      });
    }

    // Configurar estado de Música
    const audio = initAudioElement();
    updateMusicButtonState(musicBtn, !audio.paused);

    // Evento de clic en Música (Giro 360)
    if (musicBtn && !musicBtn.hasAttribute("data-music-listener")) {
      musicBtn.setAttribute("data-music-listener", "true");
      musicBtn.addEventListener("click", async () => {
        triggerSpin(musicBtn);
        const aud = initAudioElement();

        if (aud.paused) {
          try {
            await aud.play();
            updateMusicButtonState(musicBtn, true);
            window.showTopNotice("🎵 Reproduciendo música de fondo", "info", 2500);
          } catch (err) {
            console.warn("Autoplay bloqueado por el navegador:", err);
            updateMusicButtonState(musicBtn, false);
          }
        } else {
          aud.pause();
          updateMusicButtonState(musicBtn, false);
          window.showTopNotice("🔇 Música pausada", "info", 2000);
        }
      });
    }
  }

  function triggerSpin(btn) {
    if (!btn) return;
    btn.classList.remove("spin-active");
    void btn.offsetWidth; // Force reflow
    btn.classList.add("spin-active");
    btn.addEventListener("animationend", () => {
      btn.classList.remove("spin-active");
    }, { once: true });
  }

  function updateMusicButtonState(btn, isPlaying) {
    if (!btn) return;
    if (isPlaying) {
      btn.innerHTML = "🎵";
      btn.title = "Pausar música";
      btn.style.borderColor = "#2ecc71";   
    } else {
      btn.innerHTML = "🔇";
      btn.title = "Activar música";
      btn.style.borderColor = "#F249E7";
    }
  }

  function applyThemePreference(btn, showNotice = false) {
    const savedTheme = localStorage.getItem("sara15_theme") || "light";
    let lightLink = document.getElementById(LIGHT_THEME_ID);

    if (savedTheme === "light") {
      if (!lightLink) {
        lightLink = document.createElement("link");
        lightLink.id = LIGHT_THEME_ID;
        lightLink.rel = "stylesheet";
        lightLink.href = "css/main-light.css";
        document.head.appendChild(lightLink);
      }
      if (btn) {
        btn.innerHTML = "☀️";
        btn.title = "Cambiar a modo noche";
        btn.style.background = "rgba(255, 255, 255, 0.85)";
        btn.style.color = "#333";
      }
      if (showNotice) window.showTopNotice("☀️ Modo claro activado", "info", 1800);
    } else {
      if (lightLink) {
        lightLink.remove();
      }
      if (btn) {
        btn.innerHTML = "🌙";
        btn.title = "Cambiar a modo día";
        btn.style.background = "rgba(24, 6, 36, 0.85)";
        btn.style.color = "#fff";
      }
      if (showNotice) window.showTopNotice("🌙 Modo oscuro activado", "info", 1800);
    }
  }

  // Inicializar al cargar el DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureFloatingControls);
  } else {
    ensureFloatingControls();
  }
})();
