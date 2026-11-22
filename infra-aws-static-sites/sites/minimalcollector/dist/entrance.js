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
    // Navigate once the light has filled the viewport, even if animations are disabled mid-flight.
    const finish = () => {
      clearTimeout(fallback);
      foyer.removeEventListener('animationend', onEnd);
      location.assign(link.href);
    };
    const onEnd = e => {
      if (e.target === foyer && e.animationName === 'fill-room') finish();
    };
    const fallback = setTimeout(finish, 1750);
    foyer.addEventListener('animationend', onEnd);
  });
});
window.addEventListener('pageshow', () => {
  navigating = false;
  foyer.classList.remove('opening');
});
