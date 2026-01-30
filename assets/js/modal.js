(function () {
  const OPEN_ATTR = "data-modal-open";
  const CLOSE_ATTR = "data-modal-close";
  const CLEAR_GALLERY_ATTR = "data-clear-gallery";
  const TARGET_ATTR = "data-gallery-target"; // abre fancybox group por slug (opcional)

  const MODAL_SELECTOR = ".modal-simple";
  const DIALOG_SELECTOR = ".modal__dialog";
  const BACKDROP_SELECTOR = ".modal__backdrop";

  let lastActiveTrigger = null;

  /* ------------------------ shared scroll lock ------------------------ */
  const ScrollLock =
    window.__ScrollLock ||
    (window.__ScrollLock = (function () {
      let locks = 0;
      let scrollY = 0;
      let savedPaddingRight = "";

      function getScrollbarWidth() {
        return Math.max(
          0,
          window.innerWidth - document.documentElement.clientWidth,
        );
      }

      function lock(className = "is-locked") {
        locks += 1;
        if (locks > 1) return;

        scrollY = window.scrollY || window.pageYOffset || 0;

        const sbw = getScrollbarWidth();
        savedPaddingRight = document.body.style.paddingRight || "";

        document.documentElement.classList.add(className);
        document.body.classList.add(className);

        // Evita “jump”: body fixed + top negativo
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.width = "100%";

        if (sbw) document.body.style.paddingRight = `${sbw}px`;
      }

      function unlock(className = "is-locked") {
        if (locks === 0) return;
        locks -= 1;
        if (locks > 0) return;

        document.documentElement.classList.remove(className);
        document.body.classList.remove(className);

        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";

        document.body.style.paddingRight = savedPaddingRight;

        window.scrollTo(0, scrollY);
      }

      return { lock, unlock };
    })());

  /* ----------------------------- helpers ----------------------------- */

  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const qs = (sel, root = document) => root.querySelector(sel);

  const getOpenModals = () =>
    qsa(MODAL_SELECTOR).filter((m) => m.classList.contains("is-open"));

  function msFromCssVar(el, varName, fallbackMs) {
    try {
      const raw = getComputedStyle(el).getPropertyValue(varName).trim();
      if (!raw) return fallbackMs;
      if (raw.endsWith("ms")) return parseFloat(raw);
      if (raw.endsWith("s")) return parseFloat(raw) * 1000;
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : fallbackMs;
    } catch {
      return fallbackMs;
    }
  }

  function getCloseMs(modal) {
    return msFromCssVar(modal, "--modal-close-ms", 420);
  }

  function isReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  }

  function getFocusable(container) {
    const selectors = [
      "a[href]",
      "button:not([disabled])",
      'input:not([disabled]):not([type="hidden"])',
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");
    return qsa(selectors, container).filter(
      (el) =>
        !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    );
  }

  function trapFocus(modal, onClose) {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const focusables = getFocusable(modal);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    modal.__trapHandler = onKeyDown;
    document.addEventListener("keydown", onKeyDown, true);
  }

  function releaseFocusTrap(modal) {
    if (modal.__trapHandler) {
      document.removeEventListener("keydown", modal.__trapHandler, true);
      modal.__trapHandler = null;
    }
  }

  // Fancybox helpers (opcional)
  const getFB = () =>
    window.Fancybox?.getInstance?.() || window.Fancybox?.getInstance?.();

  function clearUrlHash() {
    try {
      const url = location.pathname + location.search;
      history.replaceState(null, "", url);
    } catch {
      if (location.hash) location.hash = "";
    }
  }

  function closeFancyboxAndClearHash() {
    const fb = getFB();
    try {
      fb?.close?.();
    } catch {}
    clearUrlHash();
    document.documentElement.classList.remove("with-fancybox-gallery");
  }

  function openFancyboxGroup(slug) {
    // Busca anchors con data-fancybox="slug" y arma items para Fancybox.show()
    if (!slug || !window.Fancybox?.show) return;

    const nodes = qsa(`[data-fancybox="${slug}"]`);
    if (!nodes.length) return;

    const items = nodes.map((a) => ({
      src: a.dataset.src || a.getAttribute("href"),
      type: a.dataset.type || "image",
      caption: a.dataset.caption || a.getAttribute("data-caption") || "",
    }));

    document.documentElement.classList.add("with-fancybox-gallery");
    window.Fancybox.show(items, {
      dragToClose: true,
      animated: true,
      showClass: "f-fadeIn",
      hideClass: "f-fadeOut",
    });
  }

  /* ----------------------------- core ----------------------------- */

  function openModal(modal, triggerEl) {
    if (!modal || modal.classList.contains("is-open")) return;

    // Cerrar otros abiertos (stack simple)
    getOpenModals().forEach((m) => closeModal(m, { restoreFocus: false }));

    lastActiveTrigger = triggerEl || document.activeElement;

    modal.setAttribute("aria-hidden", "false");
    modal.classList.remove("is-closing");
    modal.classList.add("is-open");

    // lock scroll global (no depende del wrapper)
    ScrollLock.lock("modal-open");

    // focus trap
    trapFocus(modal, () => closeModal(modal));

    // foco inicial
    const focusables = getFocusable(modal);
    if (focusables.length) {
      focusables[0].focus({ preventScroll: true });
    } else {
      // fallback: focus al dialog si no hay focuseables
      const dialog = qs(DIALOG_SELECTOR, modal);
      dialog?.setAttribute("tabindex", "-1");
      dialog?.focus({ preventScroll: true });
    }
  }

  function closeModal(modal, opts = {}) {
    const { restoreFocus = true } = opts;
    if (!modal || !modal.classList.contains("is-open")) return;

    const closeMs = isReducedMotion() ? 0 : getCloseMs(modal);

    modal.classList.remove("is-open");
    modal.classList.add("is-closing");

    releaseFocusTrap(modal);

    window.setTimeout(() => {
      modal.classList.remove("is-closing");
      modal.setAttribute("aria-hidden", "true");

      ScrollLock.unlock("modal-open");

      if (
        restoreFocus &&
        lastActiveTrigger &&
        typeof lastActiveTrigger.focus === "function"
      ) {
        lastActiveTrigger.focus({ preventScroll: true });
      }
    }, closeMs);
  }

  /* --------------------------- event wiring -------------------------- */

  // Open triggers
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(`[${OPEN_ATTR}]`);
    if (!trigger) return;

    const target = trigger.getAttribute(OPEN_ATTR);
    if (!target) return;

    const modal = qs(target);
    if (!modal) return;

    e.preventDefault();

    // Si te piden limpiar galería
    if (trigger.hasAttribute(CLEAR_GALLERY_ATTR)) {
      closeFancyboxAndClearHash();
    }

    // Si te piden abrir fancybox group en vez de modal
    const fbTarget = trigger.getAttribute(TARGET_ATTR);
    if (fbTarget) {
      openFancyboxGroup(fbTarget);
      return;
    }

    openModal(modal, trigger);
  });

  // Close triggers + backdrop click
  document.addEventListener("click", (e) => {
    // Close button
    const closeBtn = e.target.closest(`[${CLOSE_ATTR}]`);
    if (closeBtn) {
      const modal = closeBtn.closest(MODAL_SELECTOR);
      if (!modal) return;
      e.preventDefault();
      closeModal(modal);
      return;
    }

    // Backdrop / click fuera del dialog
    const modal = e.target.closest(MODAL_SELECTOR);
    if (!modal || !modal.classList.contains("is-open")) return;

    const dialog = qs(DIALOG_SELECTOR, modal);
    const backdrop = qs(BACKDROP_SELECTOR, modal);

    // Si clickeó el backdrop o afuera del dialog => cerrar
    if (e.target === backdrop || (dialog && !dialog.contains(e.target))) {
      e.preventDefault();
      closeModal(modal);
    }
  });

  // Seguridad: si algo quedó abierto al navegar (VT), cerralo
  window.addEventListener("pageshow", () => {
    getOpenModals().forEach((m) => closeModal(m, { restoreFocus: false }));
  });
})();
