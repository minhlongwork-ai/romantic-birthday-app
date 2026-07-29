function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function wrapText(context, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((value, index) => context.fillText(value, x, y + index * lineHeight));
}

export async function downloadPostcard({ memory, recipient, sender }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1500;
  const context = canvas.getContext('2d');

  context.fillStyle = '#efe3d2';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#aa7068';
  context.lineWidth = 3;
  context.strokeRect(52, 52, canvas.width - 104, canvas.height - 104);

  context.fillStyle = '#fffaf1';
  context.shadowColor = 'rgba(78, 47, 39, 0.22)';
  context.shadowBlur = 34;
  context.shadowOffsetY = 18;
  context.fillRect(120, 120, 960, 940);
  context.shadowColor = 'transparent';

  try {
    const image = await loadImage(memory.src);
    drawCover(context, image, 160, 160, 880, 700);
  } catch {
    context.fillStyle = '#dbc0ad';
    context.fillRect(160, 160, 880, 700);
    context.fillStyle = '#7b4f47';
    context.font = '48px Georgia, serif';
    context.textAlign = 'center';
    context.fillText('Một kỷ niệm dành cho em', 600, 520);
  }

  context.textAlign = 'left';
  context.fillStyle = '#3d302c';
  context.font = 'italic 48px Georgia, serif';
  wrapText(context, memory.caption, 170, 940, 860, 62, 2);

  context.fillStyle = '#a4665f';
  context.font = '600 28px Arial, sans-serif';
  context.letterSpacing = '4px';
  context.fillText(`HAPPY BIRTHDAY, ${recipient.name.toUpperCase()}`, 120, 1190);

  context.fillStyle = '#3d302c';
  context.font = '54px cursive';
  context.fillText(`Với tất cả yêu thương — ${sender.name}`, 120, 1300);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Không thể tạo postcard.');

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'birthday-keepsake.png';
  anchor.click();
  URL.revokeObjectURL(url);
}
