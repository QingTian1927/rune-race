(() => {
  const body = document.body;
  const menuButton = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav-links]');
  const themeButton = document.querySelector('[data-theme-toggle]');

  if (localStorage.getItem('runeRaceTheme') === 'night') body.classList.add('night');

  menuButton?.addEventListener('click', () => {
    nav?.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', nav?.classList.contains('open') ? 'true' : 'false');
  });

  nav?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => nav.classList.remove('open'));
  });

  themeButton?.addEventListener('click', () => {
    body.classList.toggle('night');
    localStorage.setItem('runeRaceTheme', body.classList.contains('night') ? 'night' : 'day');
    themeButton.setAttribute('aria-label', body.classList.contains('night') ? 'Chuyển sang giao diện ban ngày' : 'Chuyển sang giao diện ban đêm');
  });

  document.querySelectorAll('[data-accordion-button]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.closest('.accordion-item');
      item?.classList.toggle('open');
      button.setAttribute('aria-expanded', item?.classList.contains('open') ? 'true' : 'false');
    });
  });

  document.querySelectorAll('[data-card-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const group = button.dataset.cardFilter;
      document.querySelectorAll('[data-card-filter]').forEach((candidate) => candidate.classList.toggle('active', candidate === button));
      document.querySelectorAll('[data-card-group]').forEach((card) => {
        card.classList.toggle('is-hidden', group !== 'all' && card.dataset.cardGroup !== group);
      });
    });
  });

  document.querySelectorAll('[data-rail]').forEach((rail) => {
    const id = rail.dataset.rail;
    document.querySelector(`[data-rail-prev="${id}"]`)?.addEventListener('click', () => rail.scrollBy({ left: -420, behavior: 'smooth' }));
    document.querySelector(`[data-rail-next="${id}"]`)?.addEventListener('click', () => rail.scrollBy({ left: 420, behavior: 'smooth' }));
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
  } else {
    document.querySelectorAll('.reveal').forEach((element) => element.classList.add('visible'));
  }
})();
