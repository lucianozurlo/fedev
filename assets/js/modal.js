// modal.js — modales accesibles, slide desde arriba, sin dependencias
(function () {
  const OPEN_ATTR = "data-modal-open";
  const CLOSE_ATTR = "data-modal-close";
  const MODAL_SELECTOR = ".modal-simple";
  const DIALOG_SELECTOR = ".modal__dialog";

  const CLOSE_MS = 420; // debe coincidir con --modal-close-ms (aprox)

  let lastActiveTrigger = null;
  let scrollY = 0;

  const focusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  const getModal = (sel) => {
    if (!sel) return null;
    try {
      return document.querySelector(sel);
    } catch {
      return null;
    }
  };

  const isOpen = (modal) => modal?.classList.contains("is-open");

  /* ---------------------- Scroll lock (incluye iOS) ---------------------- */
  function lockScroll() {
    scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.documentElement.classList.add("no-scroll");
    document.body.classList.add("no-scroll");

    // iOS-friendly: fijar body para evitar “salto”
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockScroll() {
    document.documentElement.classList.remove("no-scroll");
    document.body.classList.remove("no-scroll");

    const top = document.body.style.top;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";

    const y = top ? Math.abs(parseInt(top, 10)) : scrollY;
    window.scrollTo(0, y || 0);
  }

  /* --------------------------- Focus management -------------------------- */
  function getFocusable(modal) {
    const dialog = modal.querySelector(DIALOG_SELECTOR) || modal;
    return Array.from(dialog.querySelectorAll(focusableSelector)).filter(
      (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
    );
  }

  function focusFirst(modal) {
    const focusables = getFocusable(modal);
    const preferred =
      modal.querySelector(`[${CLOSE_ATTR}]`) ||
      focusables[0] ||
      (modal.querySelector(DIALOG_SELECTOR) ?? modal);

    // asegurar foco
    if (preferred && preferred.tabIndex < 0) preferred.tabIndex = -1;
    preferred?.focus?.({ preventScroll: true });
  }

  function trapTab(e, modal) {
    if (e.key !== "Tab") return;

    const focusables = getFocusable(modal);
    if (!focusables.length) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ------------------------------ Open/Close ----------------------------- */
  function closeAnyOpen(exceptModal = null) {
    document.querySelectorAll(`${MODAL_SELECTOR}.is-open`).forEach((m) => {
      if (m !== exceptModal) closeModal(m);
    });
  }

  function openModal(modal, trigger = null) {
    if (!modal || isOpen(modal)) return;

    closeAnyOpen(modal);
    lastActiveTrigger = trigger || document.activeElement;

    modal.setAttribute("aria-hidden", "false");
    modal.classList.remove("is-closing");
    modal.classList.add("is-open");

    lockScroll();

    // focus
    requestAnimationFrame(() => focusFirst(modal));
  }

  function closeModal(modal) {
    if (!modal || !isOpen(modal)) return;

    modal.classList.add("is-closing");
    modal.classList.remove("is-open");

    // esperar animación de cierre
    window.setTimeout(() => {
      modal.classList.remove("is-closing");
      modal.setAttribute("aria-hidden", "true");

      // si no queda ningún modal abierto, liberar scroll
      const stillOpen = document.querySelector(`${MODAL_SELECTOR}.is-open`);
      if (!stillOpen) unlockScroll();

      // devolver foco
      lastActiveTrigger?.focus?.({ preventScroll: true });
      lastActiveTrigger = null;
    }, CLOSE_MS);
  }

  /* ------------------------------- Listeners ----------------------------- */
  document.addEventListener("click", (e) => {
    const openBtn = e.target.closest(`[${OPEN_ATTR}]`);
    if (openBtn) {
      e.preventDefault();
      const targetSel = openBtn.getAttribute(OPEN_ATTR);
      const modal = getModal(targetSel);
      openModal(modal, openBtn);
      return;
    }

    const closeBtn = e.target.closest(`[${CLOSE_ATTR}]`);
    if (closeBtn) {
      e.preventDefault();
      const modal = closeBtn.closest(MODAL_SELECTOR);
      closeModal(modal);
    }
  });

  document.addEventListener("keydown", (e) => {
    const modal = document.querySelector(`${MODAL_SELECTOR}.is-open`);
    if (!modal) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeModal(modal);
      return;
    }

    trapTab(e, modal);
  });
})();
