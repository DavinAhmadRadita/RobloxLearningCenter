(() => {
  const getCurrentUser = () =>
    sessionStorage.getItem('rlc_current_user') ||
    localStorage.getItem('rlc_remembered_user') || '';

  const protectedPages = new Set(['Modul', 'Leaderboard', 'Forum', 'Challenges']);
  const backdrop = document.createElement('div');
  backdrop.className = 'guest-gate-backdrop';
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <section class="guest-gate-dialog" role="dialog" aria-modal="true"
      aria-labelledby="guest-gate-title" aria-describedby="guest-gate-description">
      <button class="guest-gate-close" type="button" aria-label="Tutup popup">
        <i data-lucide="x"></i>
      </button>
      <h2 id="guest-gate-title">LOGIN DULU UNTUK LANJUT<br> PETUALANGANMU 🚀</h2>
      <p id="guest-gate-description">Masuk atau daftar terlebih dahulu untuk mengakses Modul, Leaderboard, Forum, dan Challenges.</p>
      <button class="guest-gate-submit" type="button">MASUK/DAFTAR</button>
    </section>`;
  document.body.appendChild(backdrop);

  let previousFocus = null;
  function openGate() {
    if (getCurrentUser()) return;
    previousFocus = document.activeElement;
    backdrop.hidden = false;
    document.body.classList.add('guest-gate-open');
    backdrop.classList.add('is-visible');
    if (window.lucide) window.lucide.createIcons();
    backdrop.querySelector('.guest-gate-close').focus();
  }
  function closeGate() {
    // Guests who dismiss the login gate should return to the public dashboard,
    // not remain on a protected page behind the closed modal.
    window.location.href = 'dashboard.html';
  }

  // Guests can navigate into protected pages. Show the gate after the destination page loads.
  const currentPage = document.body.dataset.page || '';
  if (protectedPages.has(currentPage) && !getCurrentUser()) {
    openGate();
  }

  backdrop.querySelector('.guest-gate-close').addEventListener('click', closeGate);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeGate();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) closeGate();
  });
  backdrop.querySelector('.guest-gate-submit').addEventListener('click', () => {
    window.location.href = 'login.html';
  });

  // The sidebar's existing auth button should also open the real login page.
  const authButton = document.getElementById('dashboard-auth-button');
  if (authButton && !getCurrentUser()) {
    authButton.addEventListener('click', () => { window.location.href = 'login.html'; });
  }
})();