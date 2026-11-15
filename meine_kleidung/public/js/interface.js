/* Shared interaction polish. No data submission or business logic lives here. */
(() => {
  if (window.closetInterfaceReady) return;
  window.closetInterfaceReady = true;
  const clearContext = () => { if (location.pathname.startsWith("/auth/")) { try { sessionStorage.removeItem("closet-view-context-v1"); } catch {} } };
  clearContext();
  document.addEventListener("htmx:afterSettle", clearContext);
  const updateViewport = () => {
    const view = window.visualViewport;
    const covered = view ? Math.max(0, window.innerHeight - view.height - view.offsetTop) : 0;
    document.documentElement.style.setProperty('--keyboard-inset', `${covered}px`);
    document.documentElement.classList.toggle('keyboard-open', covered > 120);
  };
  window.visualViewport?.addEventListener('resize', updateViewport);
  window.visualViewport?.addEventListener('scroll', updateViewport);
  window.addEventListener('resize', updateViewport);
  updateViewport();
  document.addEventListener('htmx:beforeRequest', event => {
    event.detail.elt?.closest('form')?.setAttribute('aria-busy', 'true');
  });
  document.addEventListener('htmx:afterRequest', event => {
    event.detail.elt?.closest('form')?.removeAttribute('aria-busy');
  });
  document.addEventListener('focusin', event => {
    if (!event.target.matches('input, textarea, select')) return;
    // Let the virtual keyboard finish resizing before checking the field.
    setTimeout(() => {
      if (document.activeElement !== event.target) return;
      const rect = event.target.getBoundingClientRect();
      const view = window.visualViewport;
      if (view && rect.bottom > view.height + view.offsetTop - 72)
        event.target.scrollIntoView({ block: 'center', behavior: 'auto' });
    }, 250);
  });
})();
