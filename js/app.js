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
const generateBtn = document.getElementById('generate-btn');
const canvas = document.getElementById('qr-canvas');
const ctx = canvas.getContext('2d');
const placeholder = document.getElementById('placeholder');
const actions = document.getElementById('actions');
const downloadPng = document.getElementById('download-png');
const downloadJpeg = document.getElementById('download-jpeg');
const downloadSvg = document.getElementById('download-svg');
const form = document.getElementById('qr-form');

let uploadedLogo = null;

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
  if (canvas.dataset.lastQr) generate();
});

logoSizeInput.addEventListener('input', () => {
  logoSizeVal.textContent = logoSizeInput.value;
  if (canvas.dataset.lastQr) generate();
});

fgColorInput.addEventListener('input', scheduleRegen);
bgColorInput.addEventListener('input', scheduleRegen);
sizeSelect.addEventListener('change', scheduleRegen);
errorLevelSelect.addEventListener('change', scheduleRegen);
marginSelect.addEventListener('change', scheduleRegen);

let regenTimer = null;
function scheduleRegen() {
  clearTimeout(regenTimer);
  regenTimer = setTimeout(() => { if (canvas.dataset.lastQr) generate(); }, 150);
}

/* ─── Main generate function ─── */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  generate();
});

async function generate() {
  const content = contentInput.value.trim();
  if (!content) return;

  const size = parseInt(sizeSelect.value, 10);
  const errorLevel = errorLevelSelect.value;
  const fg = fgColorInput.value;
  const bg = bgColorInput.value;
  const margin = parseInt(marginSelect.value, 10);

  placeholder.style.display = 'none';

  try {
    await generateQR(content, size, errorLevel, fg, bg, margin);
    canvas.dataset.lastQr = 'true';
    actions.style.display = 'flex';
  } catch (err) {
    console.error(err);
  }
}

function generateQR(text, size, errorLevel, fg, bg, margin) {
  return new Promise((resolve, reject) => {
    canvas.width = size;
    canvas.height = size;

    QRCode.toCanvas(canvas, text, {
      width: size,
      margin,
      color: { dark: fg, light: bg },
      errorCorrectionLevel: errorLevel,
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

      /* white background behind logo for contrast */
      const pad = 4;
      ctx.fillStyle = bgColorInput.value;
      ctx.fillRect(x - pad, y - pad, w + pad * 2, h + pad * 2);

      /* rounded clip for logo */
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
downloadPng.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'qrcode.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

downloadJpeg.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'qrcode.jpg';
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
});

downloadSvg.addEventListener('click', downloadAsSvg);

async function downloadAsSvg() {
  const text = contentInput.value.trim();
  if (!text) return;

  const fg = fgColorInput.value;
  const bg = bgColorInput.value;
  const errorLevel = errorLevelSelect.value;
  const margin = parseInt(marginSelect.value, 10);
  const size = parseInt(sizeSelect.value, 10);

  try {
    const svgStr = await new Promise((resolve, reject) => {
      QRCode.toString(text, {
        type: 'svg',
        width: size,
        margin,
        color: { dark: fg, light: bg },
        errorCorrectionLevel: errorLevel,
      }, (err, str) => {
        if (err) reject(err);
        else resolve(str);
      });
    });

    let finalSvg = svgStr;

    if (uploadedLogo) {
      finalSvg = await embedLogoSvg(finalSvg, size);
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
      const logoTag = `
  <image x="${x}" y="${y}" width="${w}" height="${h}" href="${logoDataUrl}" />
</svg>`;

      const svgWithLogo = svgStr.replace('</svg>', logoTag);

      const bgColor = bgColorInput.value;
      const pad = 4;
      const rect = `
  <rect x="${x - pad}" y="${y - pad}" width="${w + pad * 2}" height="${h + pad * 2}" rx="6" fill="${bgColor}" />
  <image x="${x}" y="${y}" width="${w}" height="${h}" href="${logoDataUrl}" />
</svg>`;

      const finalSvg = svgStr.replace('</svg>', rect);
      resolve(finalSvg);
    };
    img.onerror = reject;
    img.src = uploadedLogo;
  });
}

/* ─── Auto-generate on first load ─── */
generate();
