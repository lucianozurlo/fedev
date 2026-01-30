(function () {
  const OPEN_ATTR = "data-modal-open";
  const CLOSE_ATTR = "data-modal-close";
  const MODAL_SELECTOR = ".modal-simple";
  const CONTENT_SELECTOR = ".modal__dialog > .content";

const root = document.documentElement;

const readMsVar = (name, fallback) => {
  const raw = getComputedStyle(root).getPropertyValue(name).trim();
  if (!raw) return fallback;
  if (raw.endsWith("ms")) return parseFloat(raw) || fallback;
  if (raw.endsWith("s")) return parseFloat(raw) * 1000 || fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
};

// Lee el timing real desde CSS (modal.css)
const CLOSE_MS = readMsVar("--modal-close-ms", 420);


  let activeModal = null;
  let lastActive = null;
  let savedScrollY = 0;

  // touch control (iOS)
  let startY = 0;

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

function lockPage(modal) {
  savedScrollY = window.scrollY || 0;

  const sbw = window.innerWidth - document.documentElement.clientWidth;
  if (sbw > 0) document.body.style.paddingRight = sbw + "px";

  // ✅ clases para CSS y para transition.js
  root.classList.add("modal-lock", "modal-open");
  document.body.classList.add("modal-lock", "modal-open");

  // ✅ lock sólido (evita cualquier salto / rubber band iOS)
  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";

  activeModal = modal;

  // tus listeners (podés dejarlos como “cinturón y tirantes”)
  document.addEventListener("wheel", onWheel, {
    passive: false,
    capture: true,
  });
  document.addEventListener("touchmove", onDocTouchMove, {
    passive: false,
    capture: true,
  });

  const content = modal.querySelector(CONTENT_SELECTOR);
  if (content) {
    content.addEventListener("touchstart", onContentTouchStart, {
      passive: true,
    });
    content.addEventListener("touchmove", onContentTouchMove, {
      passive: false,
    });
  }
}

function unlockPage() {
  root.classList.remove("modal-lock", "modal-open");
  document.body.classList.remove("modal-lock", "modal-open");

  document.body.style.paddingRight = "";

  // sacar listeners
  document.removeEventListener("wheel", onWheel, true);
  document.removeEventListener("touchmove", onDocTouchMove, true);

  if (activeModal) {
    const content = activeModal.querySelector(CONTENT_SELECTOR);
    if (content) {
      content.removeEventListener("touchstart", onContentTouchStart);
      content.removeEventListener("touchmove", onContentTouchMove);
    }
  }

  activeModal = null;

  // ✅ restaurar scroll desde el fixed lock
  const y = savedScrollY;

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";

  window.scrollTo(0, y);
}

  function onWheel(e) {
    if (!activeModal) return;

    const content = activeModal.querySelector(CONTENT_SELECTOR);
    if (content && content.contains(e.target)) return; // permitir scroll dentro
    e.preventDefault(); // bloquear fondo
  }

  function onDocTouchMove(e) {
    if (!activeModal) return;

    const content = activeModal.querySelector(CONTENT_SELECTOR);
    if (content && content.contains(e.target)) return; // permitido (el “edge” lo maneja onContentTouchMove)
    e.preventDefault(); // bloquear fondo
  }

  function onContentTouchStart(e) {
    startY = e.touches?.[0]?.clientY ?? 0;
  }

  // evita “rubber band” que termina scrolleando la página de atrás
  function onContentTouchMove(e) {
    const content = e.currentTarget;
    const currentY = e.touches?.[0]?.clientY ?? 0;
    const dy = currentY - startY;

    const atTop = content.scrollTop <= 0;
    const atBottom =
      content.scrollTop + content.clientHeight >= content.scrollHeight - 1;

    if ((atTop && dy > 0) || (atBottom && dy < 0)) {
      e.preventDefault();
    }
  }

  function getFocusable(root) {
    return Array.from(root.querySelectorAll(focusableSelector)).filter(
      (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
    );
  }

  function safeFocus(el) {
    if (!el?.focus) return;
    const y = window.scrollY || 0;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    window.scrollTo(0, y);
  }

  function openModal(modal, trigger) {
    if (!modal || modal.classList.contains("is-open")) return;

    // cerrar otro si estuviera
    document
      .querySelectorAll(`${MODAL_SELECTOR}.is-open`)
      .forEach((m) => closeModal(m, true));

    lastActive = trigger || document.activeElement;

    modal.setAttribute("aria-hidden", "false");
    modal.classList.remove("is-closing");
    modal.classList.add("is-open");

    lockPage(modal);

    // foco adentro
    const focusables = getFocusable(modal);
    const close = modal.querySelector(`[${CLOSE_ATTR}]`);
    safeFocus(close || focusables[0] || modal);
  }

  function closeModal(modal, skipFocusRestore = false) {
    if (!modal || !modal.classList.contains("is-open")) return;

    modal.classList.add("is-closing");
    modal.classList.remove("is-open");

    window.setTimeout(() => {
      modal.classList.remove("is-closing");
      modal.setAttribute("aria-hidden", "true");

      // desbloquear si no quedan modales
      const still = document.querySelector(`${MODAL_SELECTOR}.is-open`);
      if (!still) {
        unlockPage();

        // por si algún script metió "#"
        if (location.hash === "#") {
          try {
            history.replaceState(null, "", location.pathname + location.search);
          } catch {}
        }

        if (!skipFocusRestore) safeFocus(lastActive);
      }
    }, CLOSE_MS);
  }

  function trapTab(e) {
    if (!activeModal || e.key !== "Tab") return;

    const focusables = getFocusable(activeModal);
    if (!focusables.length) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      safeFocus(last);
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      safeFocus(first);
    }
  }

  // CLICK CAPTURE: bloquea cualquier otro handler que agregue hash/scroll
  document.addEventListener(
    "click",
    (e) => {
      const openBtn = e.target.closest(`[${OPEN_ATTR}]`);
      if (openBtn) {
        e.preventDefault();
        e.stopPropagation();
        const modal = getModal(openBtn.getAttribute(OPEN_ATTR));
        openModal(modal, openBtn);
        return;
      }

      const closeBtn = e.target.closest(`[${CLOSE_ATTR}]`);
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeModal(closeBtn.closest(MODAL_SELECTOR));
      }
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (!activeModal) return;

      if (e.key === "Escape") {
        e.preventDefault();
        closeModal(activeModal);
        return;
      }

      trapTab(e);
    },
    true,
  );
})();
