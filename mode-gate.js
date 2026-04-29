async function ensureLicense(toolName) {
  const config = window.ModeConfig ? window.ModeConfig.readModeConfig() : { mode: 'beta' };
  if (!(window.ModeConfig && window.ModeConfig.shouldRequireLicense(config))) {
    return true;
  }

  try {
    await window.LicenseClient.validate(toolName || 'toolbox');
    return true;
  } catch (error) {
    const next = new URL('./license.html', window.location.href);
    next.searchParams.set('tool', toolName || 'toolbox');
    next.searchParams.set('returnTo', window.location.pathname.split('/').pop() || 'index.html');
    if (error?.message) next.searchParams.set('reason', error.message);
    window.location.href = next.toString();
    return false;
  }
}

window.ensureLicense = ensureLicense;
