const state = {
  input: '',
  name: '',
  icon: '',
  output: '',
  nameManuallyEdited: false,
  building: false,
};

const el = {
  html: document.documentElement,
  themeToggle: document.getElementById('theme-toggle'),
  themeIconDark: document.getElementById('theme-icon-dark'),
  themeIconLight: document.getElementById('theme-icon-light'),
  langToggle: document.getElementById('lang-toggle'),
  langLabel: document.querySelector('[data-i18n-lang-label]'),
  minimizeBtn: document.getElementById('minimize-btn'),
  closeBtn: document.getElementById('close-btn'),
  statusGlyph: document.getElementById('status-glyph'),
  helpToggle: document.getElementById('help-toggle'),
  helpOverlay: document.getElementById('help-overlay'),
  helpClose: document.getElementById('help-close'),
  newBuildBtn: document.getElementById('new-build-btn'),
  recentList: document.getElementById('recent-list'),
  recentEmpty: document.getElementById('recent-empty'),
  recentCount: document.getElementById('recent-count'),
  dropZone: document.getElementById('drop-zone'),
  inputPath: document.getElementById('input-path'),
  pickInput: document.getElementById('pick-input'),
  appName: document.getElementById('app-name'),
  iconPath: document.getElementById('icon-path'),
  pickIcon: document.getElementById('pick-icon'),
  clearIcon: document.getElementById('clear-icon'),
  outputPath: document.getElementById('output-path'),
  pickOutput: document.getElementById('pick-output'),
  fieldError: document.getElementById('field-error'),
  buildBtn: document.getElementById('build-btn'),
  buildSpinner: document.getElementById('build-spinner'),
  buildBtnLabel: document.getElementById('build-btn-label'),
  logOutput: document.getElementById('log-output'),
  statusText: document.getElementById('status-text'),
  successBanner: document.getElementById('success-banner'),
  exePath: document.getElementById('exe-path'),
  showExeBtn: document.getElementById('show-exe-btn'),
  buildAnotherBtn: document.getElementById('build-another-btn'),
  errorBanner: document.getElementById('error-banner'),
  buildAnotherErrorBtn: document.getElementById('build-another-error-btn'),
  openOutputBtn: document.getElementById('open-output-btn'),
};

let resolvedExePath = '';

// ---------- Language ----------

function applyLanguage() {
  const lang = getLang();
  el.html.lang = lang;
  el.html.dir = lang === 'fa' ? 'rtl' : 'ltr';
  el.html.classList.toggle('lang-fa', lang === 'fa');
  el.html.classList.toggle('lang-en', lang === 'en');
  el.langLabel.textContent = lang === 'fa' ? 'EN' : 'FA';
  renderTexts();
  renderRecent();
  if (!state.building) setStatus('idle');
}

function renderTexts() {
  document.querySelectorAll('[data-i18n]').forEach((elem) => {
    elem.textContent = t(elem.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-attr-placeholder]').forEach((elem) => {
    elem.setAttribute('placeholder', t(elem.getAttribute('data-i18n-attr-placeholder')));
  });
  el.buildBtnLabel.textContent = state.building ? t('buildingBtn') : t('buildBtn');
}

el.langToggle.addEventListener('click', () => {
  setLang(getLang() === 'fa' ? 'en' : 'fa');
  applyLanguage();
});

// ---------- Theme ----------

function applyTheme(theme) {
  el.html.setAttribute('data-theme', theme);
  el.themeIconDark.hidden = theme === 'light';
  el.themeIconLight.hidden = theme !== 'light';
}

function getTheme() {
  return localStorage.getItem('html2exe-theme') || 'dark';
}

applyTheme(getTheme());

el.themeToggle.addEventListener('click', () => {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem('html2exe-theme', next);
  applyTheme(next);
});

// ---------- Window controls ----------

el.minimizeBtn.addEventListener('click', () => window.html2exe.minimizeWindow());
el.closeBtn.addEventListener('click', () => window.html2exe.closeWindow());

// ---------- Help panel ----------

function setHelpOpen(open) {
  el.helpOverlay.classList.toggle('open', open);
  el.helpToggle.classList.toggle('active', open);
}

el.helpToggle.addEventListener('click', () => {
  setHelpOpen(!el.helpOverlay.classList.contains('open'));
});
el.helpClose.addEventListener('click', () => setHelpOpen(false));
el.helpOverlay.addEventListener('click', (e) => {
  if (e.target === el.helpOverlay) setHelpOpen(false);
});

// ---------- Status ----------
// States are told apart by shape/motion, not color: hollow ring (idle),
// pulsing dot (building), checkmark (success), x mark (error).

const STATUS_GLYPHS = {
  idle: '<span class="g-ring"></span>',
  preparing: '<span class="g-dot"></span>',
  installing: '<span class="g-dot"></span>',
  building: '<span class="g-dot"></span>',
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M4 12.5l5 5L20 7"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 5l14 14M19 5L5 19"/></svg>',
};

function setStatus(kind) {
  el.statusGlyph.innerHTML = STATUS_GLYPHS[kind] || STATUS_GLYPHS.idle;
  const map = { idle: 'statusIdle', preparing: 'statusPreparing', installing: 'statusInstalling', building: 'statusBuilding', success: 'statusDone', error: 'statusFailed' };
  el.statusText.textContent = t(map[kind] || 'statusIdle');
}

// ---------- Recent builds ----------

function getRecent() {
  try {
    return JSON.parse(localStorage.getItem('html2exe-recent') || '[]');
  } catch {
    return [];
  }
}

function addRecent(entry) {
  const list = getRecent().filter((r) => r.exePath !== entry.exePath);
  list.unshift(entry);
  localStorage.setItem('html2exe-recent', JSON.stringify(list.slice(0, 20)));
  renderRecent();
}

function removeRecent(exePath) {
  const list = getRecent().filter((r) => r.exePath !== exePath);
  localStorage.setItem('html2exe-recent', JSON.stringify(list));
  renderRecent();
}

function renderRecent() {
  const list = getRecent();
  el.recentCount.textContent = String(list.length);
  el.recentList.innerHTML = '';
  if (list.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'recent-empty';
    empty.textContent = t('recentEmpty');
    el.recentList.appendChild(empty);
    return;
  }
  list.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'recent-item';

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'recent-open';
    open.title = entry.exePath;

    const dot = document.createElement('span');
    dot.className = 'recent-dot';

    const text = document.createElement('span');
    text.className = 'recent-text';

    const name = document.createElement('span');
    name.className = 'recent-name';
    name.textContent = entry.name;

    const time = document.createElement('span');
    time.className = 'recent-time';
    time.textContent = relativeTime(entry.at);

    text.appendChild(name);
    text.appendChild(time);
    open.appendChild(dot);
    open.appendChild(text);
    open.addEventListener('click', () => window.html2exe.openPath(entry.exePath));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'recent-delete';
    del.title = t('deleteRecent');
    del.innerHTML = '<svg width="10" height="10" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.3"/></svg>';
    del.addEventListener('click', () => removeRecent(entry.exePath));

    item.appendChild(open);
    item.appendChild(del);
    el.recentList.appendChild(item);
  });
}

function relativeTime(timestamp) {
  const diffMin = Math.round((Date.now() - timestamp) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return diffMin + 'm ago';
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return diffHr + 'h ago';
  return Math.round(diffHr / 24) + 'd ago';
}

// ---------- Form helpers ----------

function basename(p) {
  return p.split(/[\\/]/).filter(Boolean).pop() || '';
}

function setInput(folder) {
  state.input = folder;
  el.inputPath.value = folder;
  if (!state.nameManuallyEdited) {
    state.name = basename(folder);
    el.appName.value = state.name;
  }
  clearFieldError();
}

el.pickInput.addEventListener('click', async () => {
  const folder = await window.html2exe.pickInputFolder();
  if (folder) setInput(folder);
});

el.newBuildBtn.addEventListener('click', resetForm);

el.appName.addEventListener('input', () => {
  state.name = el.appName.value;
  state.nameManuallyEdited = el.appName.value.trim().length > 0;
});

el.pickIcon.addEventListener('click', async () => {
  const icon = await window.html2exe.pickIcon();
  if (!icon) return;
  state.icon = icon;
  el.iconPath.value = icon;
});

el.clearIcon.addEventListener('click', () => {
  state.icon = '';
  el.iconPath.value = '';
});

el.pickOutput.addEventListener('click', async () => {
  const folder = await window.html2exe.pickOutputFolder();
  if (!folder) return;
  state.output = folder;
  el.outputPath.value = folder;
});

el.openOutputBtn.addEventListener('click', () => {
  window.html2exe.openPath(state.output);
});

function clearFieldError() {
  el.fieldError.textContent = '';
  el.fieldError.hidden = true;
}

function showFieldError(message) {
  el.fieldError.textContent = message;
  el.fieldError.hidden = false;
}

function setBuilding(building) {
  state.building = building;
  el.buildBtn.disabled = building;
  el.buildSpinner.hidden = !building;
  el.buildBtnLabel.textContent = building ? t('buildingBtn') : t('buildBtn');
}

function statusFromLine(line) {
  if (line.includes('Installing template dependencies')) return 'installing';
  if (line.includes('Building portable')) return 'building';
  if (line.includes('Preparing build')) return 'preparing';
  return null;
}

el.buildBtn.addEventListener('click', async () => {
  if (state.building) return;
  if (!state.input) {
    showFieldError(t('errNoInput'));
    return;
  }
  clearFieldError();
  el.successBanner.hidden = true;
  el.errorBanner.hidden = true;
  el.logOutput.textContent = '';
  setBuilding(true);
  setStatus('preparing');

  const result = await window.html2exe.startBuild({
    input: state.input,
    name: state.name,
    icon: state.icon,
    output: state.output,
  });

  if (!result.ok) {
    setBuilding(false);
    setStatus('idle');
    showFieldError(result.error || t('errorTitle'));
  }
});

window.html2exe.onLog((chunk) => {
  el.logOutput.textContent += chunk;
  el.logOutput.scrollTop = el.logOutput.scrollHeight;

  const doneMatch = chunk.match(/Done\. Your app is here: (.+)/);
  if (doneMatch) resolvedExePath = doneMatch[1].trim();

  chunk.split('\n').forEach((line) => {
    const status = statusFromLine(line);
    if (status) setStatus(status);
  });
});

window.html2exe.onDone(() => {
  setBuilding(false);
  setStatus('success');
  el.exePath.textContent = resolvedExePath;
  el.successBanner.hidden = false;
  addRecent({ name: state.name || basename(state.input), exePath: resolvedExePath, at: Date.now() });
});

window.html2exe.onError(() => {
  setBuilding(false);
  setStatus('error');
  el.errorBanner.hidden = false;
});

el.showExeBtn.addEventListener('click', () => {
  if (resolvedExePath) window.html2exe.openPath(resolvedExePath);
});

function resetForm() {
  state.input = '';
  state.name = '';
  state.icon = '';
  state.nameManuallyEdited = false;
  resolvedExePath = '';
  el.inputPath.value = '';
  el.appName.value = '';
  el.iconPath.value = '';
  el.logOutput.textContent = '';
  el.successBanner.hidden = true;
  el.errorBanner.hidden = true;
  clearFieldError();
  setStatus('idle');
}

el.buildAnotherBtn.addEventListener('click', resetForm);
el.buildAnotherErrorBtn.addEventListener('click', resetForm);

['dragover', 'dragenter'].forEach((evt) => {
  el.dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    el.dropZone.classList.add('drag-over');
  });
});
['dragleave', 'drop'].forEach((evt) => {
  el.dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    el.dropZone.classList.remove('drag-over');
  });
});
el.dropZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  const path = file.path;
  if (!path) return;
  setInput(path);
});

async function init() {
  applyLanguage();
  const defaultOutput = await window.html2exe.getDefaultOutput();
  state.output = defaultOutput;
  el.outputPath.value = defaultOutput;
}

init();
