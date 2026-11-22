(() => {
  if (location.hostname !== 'policycock.aws.shdkej.com') return;

  // Keep the withdrawal link and any existing browser-only records on their original origin.
  if (location.hash.startsWith('#launch-withdraw=')) return;
  try {
    const legacyKeys = ['modu-policy-map-v1', 'policycock.launch.withdraw.v3', 'policycock.launch.retry.v3'];
    if (legacyKeys.some(key => localStorage.getItem(key) !== null)) return;
  } catch {
    return;
  }

  const destination = new URL(location.href);
  destination.hostname = 'policy.minimalcollector.com';
  location.replace(destination.href);
})();
