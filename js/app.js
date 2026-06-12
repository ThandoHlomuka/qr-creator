const contentInput = document.getElementById('content');
const sizeSelect = document.getElementById('size');
const errorLevelSelect = document.getElementById('error-level');
const fgColorInput = document.getElementById('fg-color');
const bgColorInput = document.getElementById('bg-color');
const colorTheme = document.getElementById('color-theme');
const fgGradient = document.getElementById('fg-gradient');
const gradientOptions = document.getElementById('gradient-options');
const gradientColor = document.getElementById('gradient-color');
const gradientType = document.getElementById('gradient-type');
const logoUpload = document.getElementById('logo-upload');
const logoPreview = document.getElementById('logo-preview');
const logoImg = document.getElementById('logo-img');
const removeLogoBtn = document.getElementById('remove-logo');
const logoSizeInput = document.getElementById('logo-size');
const logoSizeVal = document.getElementById('logo-size-val');
const logoSizeField = document.getElementById('logo-size-field');
const logoStyleFields = document.getElementById('logo-style-fields');
const logoPadding = document.getElementById('logo-padding');
const logoShape = document.getElementById('logo-shape');
const logoBorder = document.getElementById('logo-border');
const marginSelect = document.getElementById('margin');
const qrType = document.getElementById('qr-type');
const dynamicFields = document.getElementById('dynamic-fields');
const qrSlug = document.getElementById('qr-slug');
const manageKey = document.getElementById('manage-key');
const autoDownload = document.getElementById('auto-download');
const generateBtn = document.getElementById('generate-btn');
const canvas = document.getElementById('qr-canvas');
const ctx = canvas.getContext('2d');
const placeholder = document.getElementById('placeholder');
const actions = document.getElementById('actions');
const downloadPng = document.getElementById('download-png');
const downloadJpeg = document.getElementById('download-jpeg');
const downloadSvg = document.getElementById('download-svg');
const form = document.getElementById('qr-form');
const dynamicManage = document.getElementById('dynamic-manage');
const qrList = document.getElementById('qr-list');
const editPanel = document.getElementById('edit-panel');
const editDestination = document.getElementById('edit-destination');
const editKeyConfirm = document.getElementById('edit-key-confirm');
const editTitle = document.getElementById('edit-title');
const saveEdit = document.getElementById('save-edit');
const cancelEdit = document.getElementById('cancel-edit');

let uploadedLogo = null;
let editingCode = null;

const API_BASE = '/api/qr';

/* ─── Color theme presets ─── */
colorTheme.addEventListener('change', () => {
  if (!colorTheme.value) return;
  const [fg, bg] = colorTheme.value.split('-');
  fgColorInput.value = `#${fg}`;
  bgColorInput.value = `#${bg}`;
  scheduleRegen();
});

/* ─── Gradient toggle ─── */
fgGradient.addEventListener('change', () => {
  gradientOptions.style.display = fgGradient.checked ? 'block' : 'none';
  scheduleRegen();
});
gradientColor.addEventListener('input', scheduleRegen);
gradientType.addEventListener('change', scheduleRegen);

/* ─── Toggle dynamic fields ─── */
qrType.addEventListener('change', () => {
  const isDynamic = qrType.value === 'dynamic';
  dynamicFields.style.display = isDynamic ? 'block' : 'none';
  manageKey.required = isDynamic;
  if (!isDynamic) dynamicManage.style.display = 'none';
});

/* ─── Logo upload handling ─── */
logoUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    uploadedLogo = ev.target.result;
    logoImg.src = uploadedLogo;
    logoPreview.classList.remove('hidden');
    logoSizeField.style.display = 'flex';
    logoStyleFields.style.display = 'block';
  };
  reader.readAsDataURL(file);
});

removeLogoBtn.addEventListener('click', () => {
  uploadedLogo = null;
  logoUpload.value = '';
  logoPreview.classList.add('hidden');
  logoSizeField.style.display = 'none';
  logoStyleFields.style.display = 'none';
  if (canvas.dataset.lastQr) generateQr();
});

logoSizeInput.addEventListener('input', () => {
  logoSizeVal.textContent = logoSizeInput.value;
  if (canvas.dataset.lastQr) generateQr();
});

[logoPadding, logoShape, logoBorder].forEach(el =>
  el.addEventListener('change', () => { if (canvas.dataset.lastQr) generateQr(); })
);

fgColorInput.addEventListener('input', () => { colorTheme.value = ''; scheduleRegen(); });
bgColorInput.addEventListener('input', () => { colorTheme.value = ''; scheduleRegen(); });
sizeSelect.addEventListener('change', scheduleRegen);
errorLevelSelect.addEventListener('change', scheduleRegen);
marginSelect.addEventListener('change', scheduleRegen);

let regenTimer = null;
function scheduleRegen() {
  clearTimeout(regenTimer);
  regenTimer = setTimeout(() => { if (canvas.dataset.lastQr) generateQr(); }, 150);
}

/* ─── Generate (re-gen from current state) ─── */
async function generateQr() {
  const content = contentInput.value.trim();
  if (!content) return;
  placeholder.style.display = 'none';
  await createQrOnCanvas(content);
  canvas.dataset.lastQr = 'true';
  actions.style.display = 'flex';
}

/* ─── Main form submit ─── */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  let targetContent = contentInput.value.trim();
  if (!targetContent) return;

  const isDynamic = qrType.value === 'dynamic';
  const key = manageKey.value.trim();

  if (isDynamic && !key) {
    showToast('Please enter a management key for your dynamic QR code.');
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating\u2026';

  try {
    if (isDynamic) {
      const slug = qrSlug.value.trim() || generateSlug();
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, destination: targetContent, key }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || 'Failed to create dynamic QR code.');
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate QR Code';
        return;
      }
      const data = await res.json();
      targetContent = data.redirectUrl;
    }

    placeholder.style.display = 'none';
    await createQrOnCanvas(targetContent);
    canvas.dataset.lastQr = 'true';
    actions.style.display = 'flex';

    if (isDynamic) {
      dynamicManage.style.display = 'block';
      refreshQrList();
    }

    if (autoDownload.checked) triggerDownload('png');
  } catch (err) {
    console.error(err);
    showToast('Something went wrong. Please try again.');
  }

  generateBtn.disabled = false;
  generateBtn.textContent = 'Generate QR Code';
});

function generateSlug() {
  return Math.random().toString(36).substring(2, 8);
}

/* ─── QR code generation pipeline ─── */
function createQrOnCanvas(text) {
  return new Promise((resolve, reject) => {
    const size = parseInt(sizeSelect.value, 10);
    canvas.width = size;
    canvas.height = size;

    QRCode.toCanvas(canvas, text, {
      width: size,
      margin: parseInt(marginSelect.value, 10),
      color: { dark: fgColorInput.value, light: bgColorInput.value },
      errorCorrectionLevel: errorLevelSelect.value,
    }, async (err) => {
      if (err) { reject(err); return; }

      if (fgGradient.checked) applyGradient(size);
      if (uploadedLogo) await overlayLogo(size);

      resolve();
    });
  });
}

/* ─── Gradient effect ─── */
function applyGradient(size) {
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const toColor = hexToRgb(gradientColor.value);
  const fromColor = hexToRgb(fgColorInput.value);
  const type = gradientType.value;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      if (data[idx + 3] === 0) continue;

      const isDark = data[idx] < 128 && data[idx + 1] < 128 && data[idx + 2] < 128;
      if (!isDark) continue;

      let t;
      if (type === 'radial') {
        const cx = size / 2, cy = size / 2;
        t = Math.min(1, Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (size / 2));
      } else {
        t = x / size;
      }

      data[idx] = lerp(fromColor.r, toColor.r, t);
      data[idx + 1] = lerp(fromColor.g, toColor.g, t);
      data[idx + 2] = lerp(fromColor.b, toColor.b, t);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

/* ─── Logo overlay (improved) ─── */
function overlayLogo(size) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const logoPct = parseInt(logoSizeInput.value, 10) / 100;
      const maxDim = size * logoPct;
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w > h) {
        if (w > maxDim) { h *= maxDim / w; w = maxDim; }
      } else {
        if (h > maxDim) { w *= maxDim / h; h = maxDim; }
      }

      const x = (size - w) / 2;
      const y = (size - h) / 2;
      const pad = parseInt(logoPadding.value, 10);

      const bgX = x - pad;
      const bgY = y - pad;
      const bgW = w + pad * 2;
      const bgH = h + pad * 2;

      ctx.save();

      if (logoShape.value === 'circle') {
        const cx = size / 2;
        const cy = size / 2;
        const r = Math.max(bgW, bgH) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = bgColorInput.value;
        ctx.fill();
        ctx.clip();
      } else {
        roundRect(ctx, bgX, bgY, bgW, bgH, 10);
        ctx.fillStyle = bgColorInput.value;
        ctx.fill();
        ctx.clip();
      }

      ctx.drawImage(img, x, y, w, h);

      if (logoBorder.checked) {
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        if (logoShape.value === 'circle') {
          const cx = size / 2, cy = size / 2, r = Math.max(bgW, bgH) / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          roundRect(ctx, bgX, bgY, bgW, bgH, 10);
          ctx.stroke();
        }
      }

      ctx.restore();
      resolve();
    };
    img.onerror = resolve;
    img.src = uploadedLogo;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ─── Downloads ─── */
downloadPng.addEventListener('click', () => triggerDownload('png'));
downloadJpeg.addEventListener('click', () => triggerDownload('jpeg'));
downloadSvg.addEventListener('click', downloadAsSvg);

function triggerDownload(format) {
  if (format === 'svg') { downloadAsSvg(); return; }
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const quality = format === 'jpeg' ? 0.95 : undefined;
  const link = document.createElement('a');
  link.download = `qrcode.${ext}`;
  link.href = canvas.toDataURL(mime, quality);
  link.click();
}

async function downloadAsSvg() {
  const text = contentInput.value.trim();
  if (!text) return;
  try {
    const svgStr = await new Promise((resolve, reject) => {
      QRCode.toString(text, {
        type: 'svg',
        width: parseInt(sizeSelect.value, 10),
        margin: parseInt(marginSelect.value, 10),
        color: { dark: fgColorInput.value, light: bgColorInput.value },
        errorCorrectionLevel: errorLevelSelect.value,
      }, (err, str) => {
        if (err) reject(err);
        else resolve(str);
      });
    });
    let finalSvg = svgStr;
    if (uploadedLogo) finalSvg = await embedLogoSvg(finalSvg, parseInt(sizeSelect.value, 10));
    const blob = new Blob([finalSvg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = 'qrcode.svg';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    console.error(err);
  }
}

function embedLogoSvg(svgStr, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const logoPct = parseInt(logoSizeInput.value, 10) / 100;
      const maxDim = size * logoPct;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > h) { if (w > maxDim) { h *= maxDim / w; w = maxDim; } }
      else { if (h > maxDim) { w *= maxDim / h; h = maxDim; } }
      const x = (size - w) / 2, y = (size - h) / 2;
      const logoDataUrl = canvas.toDataURL('image/png');
      const bgColor = bgColorInput.value;
      const pad = parseInt(logoPadding.value, 10);
      const rect = `
  <rect x="${x - pad}" y="${y - pad}" width="${w + pad * 2}" height="${h + pad * 2}" rx="10" fill="${bgColor}" />
  <image x="${x}" y="${y}" width="${w}" height="${h}" href="${logoDataUrl}" />
</svg>`;
      resolve(svgStr.replace('</svg>', rect));
    };
    img.onerror = reject;
    img.src = uploadedLogo;
  });
}

/* ─── Dynamic QR management ─── */
async function refreshQrList() {
  try {
    const res = await fetch(API_BASE);
    const data = await res.json();
    if (!data.qrs || data.qrs.length === 0) {
      qrList.innerHTML = '<p class="hint">No dynamic QR codes created yet.</p>';
      return;
    }
    qrList.innerHTML = data.qrs.map(qr => `
      <div class="qr-card">
        <div class="qr-card-info">
          <div class="slug">/${qr.slug}</div>
          <div class="dest" title="${escapeHtml(qr.destination)}">${escapeHtml(qr.destination)}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px">Scans: ${qr.scans || 0}</div>
        </div>
        <div class="qr-card-actions">
          <button class="btn btn-outline btn-sm" onclick="editQr('${qr.slug}')">Edit</button>
          <button class="btn btn-outline btn-sm" style="color:#ef4444;border-color:#fecaca" onclick="deleteQr('${qr.slug}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) { console.error(err); }
}

window.editQr = function(code) {
  editingCode = code;
  editTitle.textContent = `Edit /${code}`;
  editDestination.value = '';
  editKeyConfirm.value = '';
  editPanel.style.display = 'block';
};

window.deleteQr = async function(code) {
  const key = prompt(`Enter management key for /${code} to delete:`);
  if (!key) return;
  try {
    const res = await fetch(`${API_BASE}/${code}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) { const err = await res.json(); showToast(err.error || 'Delete failed.'); return; }
    showToast(`/${code} deleted.`);
    refreshQrList();
  } catch (err) { console.error(err); showToast('Delete failed.'); }
};

saveEdit.addEventListener('click', async () => {
  const destination = editDestination.value.trim();
  const key = editKeyConfirm.value.trim();
  if (!destination || !key) { showToast('Please fill in all fields.'); return; }
  try {
    const res = await fetch(`${API_BASE}/${editingCode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, key }),
    });
    if (!res.ok) { const err = await res.json(); showToast(err.error || 'Update failed.'); return; }
    showToast(`/${editingCode} updated!`);
    editPanel.style.display = 'none';
    editingCode = null;
    refreshQrList();
  } catch (err) { console.error(err); showToast('Update failed.'); }
});

cancelEdit.addEventListener('click', () => {
  editPanel.style.display = 'none';
  editingCode = null;
});

/* ─── Toast ─── */
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._hide);
  toast._hide = setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
