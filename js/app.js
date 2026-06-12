const contentInput = document.getElementById('content');
const sizeSelect = document.getElementById('size');
const errorLevelSelect = document.getElementById('error-level');
const fgColorInput = document.getElementById('fg-color');
const bgColorInput = document.getElementById('bg-color');
const logoUpload = document.getElementById('logo-upload');
const logoPreview = document.getElementById('logo-preview');
const logoImg = document.getElementById('logo-img');
const removeLogoBtn = document.getElementById('remove-logo');
const logoSizeInput = document.getElementById('logo-size');
const logoSizeVal = document.getElementById('logo-size-val');
const logoSizeField = document.getElementById('logo-size-field');
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

/* ─── Toggle dynamic fields ─── */
qrType.addEventListener('change', () => {
  const isDynamic = qrType.value === 'dynamic';
  dynamicFields.style.display = isDynamic ? 'block' : 'none';
  manageKey.required = isDynamic;
  if (!isDynamic) {
    dynamicManage.style.display = 'none';
  }
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
  };
  reader.readAsDataURL(file);
});

removeLogoBtn.addEventListener('click', () => {
  uploadedLogo = null;
  logoUpload.value = '';
  logoPreview.classList.add('hidden');
  logoSizeField.style.display = 'none';
  if (canvas.dataset.lastQr) generateQr();
});

logoSizeInput.addEventListener('input', () => {
  logoSizeVal.textContent = logoSizeInput.value;
  if (canvas.dataset.lastQr) generateQr();
});

fgColorInput.addEventListener('input', scheduleRegen);
bgColorInput.addEventListener('input', scheduleRegen);
sizeSelect.addEventListener('change', scheduleRegen);
errorLevelSelect.addEventListener('change', scheduleRegen);
marginSelect.addEventListener('change', scheduleRegen);

let regenTimer = null;
function scheduleRegen() {
  clearTimeout(regenTimer);
  regenTimer = setTimeout(() => { if (canvas.dataset.lastQr) generateQr(); }, 150);
}

/* ─── Generate (re-gen from current canvas state) ─── */
async function generateQr() {
  const content = contentInput.value.trim();
  if (!content) return;

  placeholder.style.display = 'none';
  await createQrOnCanvas(content);
  canvas.dataset.lastQr = 'true';
  actions.style.display = 'flex';
}

/* ─── Form submit handler ─── */
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

    if (autoDownload.checked) {
      triggerDownload('png');
    }
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

/* ─── QR generation ─── */
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

      if (uploadedLogo) {
        await overlayLogo(size);
      }
      resolve();
    });
  });
}

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

      const pad = 4;
      ctx.fillStyle = bgColorInput.value;
      ctx.fillRect(x - pad, y - pad, w + pad * 2, h + pad * 2);

      ctx.save();
      roundRect(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, 6);
      ctx.clip();
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();

      resolve();
    };
    img.onerror = resolve;
    img.src = uploadedLogo;
  });
}

function roundRect(ctx, x, y, w, h, r) {
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
  if (format === 'svg') {
    downloadAsSvg();
    return;
  }

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
    if (uploadedLogo) {
      finalSvg = await embedLogoSvg(finalSvg, parseInt(sizeSelect.value, 10));
    }

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
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w > h) {
        if (w > maxDim) { h *= maxDim / w; w = maxDim; }
      } else {
        if (h > maxDim) { w *= maxDim / h; h = maxDim; }
      }

      const x = (size - w) / 2;
      const y = (size - h) / 2;

      const logoDataUrl = canvas.toDataURL('image/png');
      const bgColor = bgColorInput.value;
      const pad = 4;
      const rect = `
  <rect x="${x - pad}" y="${y - pad}" width="${w + pad * 2}" height="${h + pad * 2}" rx="6" fill="${bgColor}" />
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
  } catch (err) {
    console.error(err);
  }
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

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Delete failed.');
      return;
    }

    showToast(`/${code} deleted.`);
    refreshQrList();
  } catch (err) {
    console.error(err);
    showToast('Delete failed.');
  }
};

saveEdit.addEventListener('click', async () => {
  const destination = editDestination.value.trim();
  const key = editKeyConfirm.value.trim();

  if (!destination || !key) {
    showToast('Please fill in all fields.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/${editingCode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, key }),
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Update failed.');
      return;
    }

    showToast(`/${editingCode} updated!`);
    editPanel.style.display = 'none';
    editingCode = null;
    refreshQrList();
  } catch (err) {
    console.error(err);
    showToast('Update failed.');
  }
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
