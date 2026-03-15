// nav.js — OpenClaw Shell SPA
// Minimal shim: the unified index.html handles all navigation internally.
// This file is retained for compatibility if any individual mockup files
// are opened directly. It no longer injects a floating nav bar.
(function() {
  // No-op when loaded inside the unified SPA (index.html already has its own router).
  if (document.querySelector('.view')) return;

  // Fallback for individual mockup files: redirect to the SPA with a hash hint.
  const page = location.pathname.split('/').pop().replace('.html', '');
  const viewMap = {
    'morning-brief-agents': 'home',
    'agent-task-cards':     'tasks',
    'draft-review-page':    'draft',
    'agent-roster':         'agents',
  };
  const target = viewMap[page];
  if (target) {
    const base = location.pathname.replace(/[^/]*$/, '');
    window.location.replace(base + 'index.html#' + target);
  }
})();
