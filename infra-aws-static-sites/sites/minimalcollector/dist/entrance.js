const foyer = document.querySelector('.foyer');
let navigating = false;
document.querySelectorAll('.threshold, .enter').forEach(link => {
  link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();
    if (navigating) return;
    navigating = true;
    foyer.classList.add('opening');
    setTimeout(() => location.assign(link.href), 1250);
  });
});
window.addEventListener('pageshow', () => {
  navigating = false;
  foyer.classList.remove('opening');
});
