// Reduce una imagen elegida por el usuario para poder guardarla en el dispositivo.
export async function reducirImagen(archivo, { lado = 1920, cuadrada = false, calidad = 0.82 } = {}) {
  const bmp = await createImageBitmap(archivo);
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (cuadrada) {
    const m = Math.min(sw, sh);
    sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m;
  }
  const k = Math.min(1, lado / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  c.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', calidad);
}

export function elegirImagen() {
  return new Promise((ok) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'image/*';
    i.onchange = () => ok(i.files[0] || null);
    i.click();
  });
}
