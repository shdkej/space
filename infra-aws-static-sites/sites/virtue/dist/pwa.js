// Capture the browser's one-use install prompt even when /me opens later.
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  window.virtueInstallPrompt = event;
  window.dispatchEvent(new Event("virtue:install-prompt"));
});

window.addEventListener("appinstalled", () => {
  window.virtueInstallPrompt = undefined;
  window.dispatchEvent(new Event("virtue:install-prompt"));
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
    // The web app still works in browsers that disallow service workers.
  });
}
