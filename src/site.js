/* Theme + small interactions. Loaded in <head> so the theme applies before first paint. */

(function () {
  var stored = null;
  try { stored = localStorage.getItem('theme'); } catch (e) {}
  var theme = stored ||
    (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.theme-toggle');

    function updateIcon() {
      if (btn) btn.textContent = document.documentElement.dataset.theme === 'dark' ? '☀' : '☾';
    }

    if (btn) {
      updateIcon();
      btn.addEventListener('click', function () {
        var dark = document.documentElement.dataset.theme === 'dark';
        if (dark) {
          delete document.documentElement.dataset.theme;
        } else {
          document.documentElement.dataset.theme = 'dark';
        }
        try { localStorage.setItem('theme', dark ? 'light' : 'dark'); } catch (e) {}
        updateIcon();
      });
    }

    var pic = document.querySelector('[data-sound]');
    if (pic) {
      pic.classList.add('clickable');
      pic.addEventListener('click', function () {
        new Audio(pic.getAttribute('data-sound')).play().catch(function () {});
      });
    }
  });
})();
