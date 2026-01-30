// modal.js — modales accesibles, slide desde arriba, scroll interno OK, sin salto de página
(function () {
  const OPEN_ATTR = "data-modal-open";
  const CLOSE_ATTR = "data-modal-close";
  const MODAL_SELECTOR = ".modal-simple";
  const DIALOG_SELECTOR = ".modal__dialog";

  const CLOSE_MS = 420; // debe matchear tu --modal-close-ms

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

    // iOS-friendly lock
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockScroll() {
    document.documentElement.classList.remove("no-scroll");
    document.body.classList.remove("no-scroll");

    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";

    // restauración exacta
    window.scrollTo(0, scrollY);
  }

  /* -------------------------- Focus + no-scroll-jump -------------------------- */
  function safeFocus(el) {
    if (!el?.focus) return;

    // guardo el scroll actual por si el browser lo mueve al focusear
    const y = window.scrollY || 0;

    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }

    // blindaje: vuelvo a donde estaba
    window.scrollTo(0, y);
  }

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

    if (preferred && preferred.tabIndex < 0) preferred.tabIndex = -1;
    safeFocus(preferred);
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
      safeFocus(last);
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      safeFocus(first);
    }
  }

  function clearLonelyHash() {
    // por si algún handler externo igual te pone "#"
    if (location.hash === "#") {
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch {}
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

    requestAnimationFrame(() => focusFirst(modal));
  }

  function closeModal(modal) {
    if (!modal || !isOpen(modal)) return;

    modal.classList.add("is-closing");
    modal.classList.remove("is-open");

    window.setTimeout(() => {
      modal.classList.remove("is-closing");
      modal.setAttribute("aria-hidden", "true");

      const stillOpen = document.querySelector(`${MODAL_SELECTOR}.is-open`);
      if (!stillOpen) {
        unlockScroll();
        clearLonelyHash();

        // devolver foco sin mover scroll
        safeFocus(lastActiveTrigger);
        // y por las dudas, reafirmo scroll (algunos browsers lo mueven igual)
        window.scrollTo(0, scrollY);
      }

      lastActiveTrigger = null;
    }, CLOSE_MS);
  }

  /* ------------------------------- Listeners (CAPTURE) ----------------------------- */
  document.addEventListener(
    "click",
    (e) => {
      const openBtn = e.target.closest(`[${OPEN_ATTR}]`);
      if (openBtn) {
        e.preventDefault();
        e.stopPropagation();
        const targetSel = openBtn.getAttribute(OPEN_ATTR);
        openModal(getModal(targetSel), openBtn);
        return;
      }

      const closeBtn = e.target.closest(`[${CLOSE_ATTR}]`);
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeModal(closeBtn.closest(MODAL_SELECTOR));
      }
    },
    true, // capture
  );

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
