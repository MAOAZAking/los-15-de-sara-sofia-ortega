# 👑 Los 15 de Sara Sofía Ortega Ayala | Smart RSVP & Event Dashboard

![Arquitectura Serverless](https://img.shields.io/badge/Architecture-Serverless-purple?style=for-the-badge)
![UI/UX](https://img.shields.io/badge/UI%2FUX-Glassmorphism-pink?style=for-the-badge)
![Security](https://img.shields.io/badge/Security-SHA--256-green?style=for-the-badge)

Una aplicación web de grado de producción diseñada exclusivamente para la gestión integral de la celebración de los 15 Años de Sara Sofía. Este proyecto redefine la experiencia de las invitaciones digitales fusionando un diseño UI/UX inmersivo con una arquitectura Serverless robusta.

## 🚀 Arquitectura y Tecnologías
Este sistema desafía los límites del alojamiento estático al convertir **GitHub Pages** en una plataforma dinámica de tiempo real.
* **Frontend:** HTML5, CSS3 Avanzado (Variables Nativas, Glassmorphism, Animaciones CSS), Vanilla JavaScript (ES6+).
* **Backend / Database:** Google Apps Script actuando como puente Serverless para ejecutar transacciones atómicas directamente sobre la base de datos JSON en GitHub (`database.json`).
* **Seguridad:** Criptografía asimétrica SHA-256 en el cliente para la ofuscación de URLs y validación de credenciales Serverless encriptadas.

## ✨ Características Principales (UX/UI Frontline)

### 1. Invitación Inmersiva y Modo Dual (Light/Dark)
* Diseño "Premium Light" y "Dark Mode" alternables en tiempo real mediante un controlador flotante. Persistencia de preferencias de usuario a través de `localStorage`.
* **API de Web Audio:** Sistema de reproducción musical progresiva (Fade-In) y estabilización de frecuencias.
* **Canvas Interactivo:** Partículas de destellos y polvo de estrellas renderizadas a 60FPS.

### 2. Algoritmo Inteligente de Reservas (RSVP)
* Base de datos estrictamente limitada a 90 cupos atómicos.
* Validación de aforo en tiempo real antes y durante la inyección de datos.
* **Sistema de Desbloqueo Progresivo:** Los campos del formulario aplican validaciones Regex dinámicas y se desbloquean en cascada para guiar visualmente al usuario.
* Identificación automática de "Líderes de Grupo" y restauración inteligente de acompañantes a partir del histórico de la base de datos.

### 3. Pases VIP Digitales (QR) y Persistencia
* Inyección de Cookies persistentes aseguradas (vigentes hasta el 21 de Dic de 2026).
* Al confirmar, el sistema previene reservas dobles y reemplaza la vista del formulario por un **Pase VIP con Código QR Único** generado matemáticamente.
* Integración fluida (1-click) para agendar el evento en Google Calendar y ver la ruta en Google Maps.

### 4. Dashboard de Control (Administración y Puerta)
* Rutas protegidas mediante un túnel de validación Serverless y autodestrucción del DOM.
* **Escáner Continuo en Vivo:** Módulo de recepción que detecta y procesa QRs sin intervención manual, actualizando las métricas instantáneamente.
* **Confeti Digital:** Micro-interacción de celebración proyectada en pantalla durante 3 segundos al confirmar un ingreso válido, antes de rearmar la cámara automáticamente.

---
*Desarrollado para crear una experiencia inolvidable. Diciembre 2026.*