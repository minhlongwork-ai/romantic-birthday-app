function assetVariant(src, extension) {
  return src.replace(/\.(jpe?g|png|webp|avif)$/i, `.${extension}`);
}

function createPicture(memory, { eager = false, className = '' } = {}) {
  const picture = document.createElement('picture');
  if (className) picture.className = className;

  const avif = document.createElement('source');
  avif.type = 'image/avif';
  avif.srcset = assetVariant(memory.src, 'avif');

  const webp = document.createElement('source');
  webp.type = 'image/webp';
  webp.srcset = assetVariant(memory.src, 'webp');

  const image = document.createElement('img');
  image.src = memory.src;
  image.alt = memory.alt;
  image.loading = eager ? 'eager' : 'lazy';
  image.decoding = 'async';
  image.draggable = false;
  image.addEventListener('error', () => {
    picture.classList.add('is-missing');
    image.alt = `${memory.alt} — ảnh chưa sẵn sàng`;
  });

  picture.append(avif, webp, image);
  return picture;
}

export function createGalleryScene({
  memories,
  track,
  viewport,
  chapterTabs,
  progress,
  dialog,
  dialogPicture,
  dialogCaption,
  dialogCounter,
  closeButton,
  onProgress = () => {},
}) {
  let currentIndex = 0;
  let active = false;
  let rendered = false;
  let lastFocused = null;
  let pointerStart = null;

  const chapters = [...new Set(memories.map(memory => memory.chapter).filter(Boolean))];

  function update() {
    const pages = [...track.querySelectorAll('.memory-page')];
    const currentPage = pages[currentIndex];
    if (!currentPage) return;

    track.style.transform = `translate3d(${-currentPage.offsetLeft}px, 0, 0)`;
    pages.forEach((page, index) => {
      const isCurrent = index === currentIndex;
      page.classList.toggle('is-current', isCurrent);
      page.setAttribute('aria-hidden', String(!isCurrent));
      page.inert = !isCurrent;
      const photoButton = page.querySelector('.memory-photo');
      if (photoButton) photoButton.tabIndex = isCurrent ? 0 : -1;
    });

    const memory = memories[currentIndex];
    progress.textContent = `Trang ${currentIndex + 1} / ${memories.length}`;
    chapterTabs.querySelectorAll('.chapter-tab').forEach(tab => {
      const selected = tab.dataset.chapter === memory.chapter;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-current', selected ? 'true' : 'false');
    });
    onProgress(currentIndex);
  }

  function goTo(index) {
    currentIndex = Math.max(0, Math.min(index, memories.length - 1));
    update();
  }

  function renderTabs() {
    chapterTabs.replaceChildren();
    chapters.forEach(chapter => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chapter-tab';
      button.dataset.chapter = chapter;
      button.textContent = chapter;
      button.addEventListener('click', () => {
        const index = memories.findIndex(memory => memory.chapter === chapter);
        goTo(index);
      });
      chapterTabs.append(button);
    });
  }

  function openLightbox(index, trigger) {
    goTo(index);
    const memory = memories[index];
    dialogPicture.replaceChildren(createPicture(memory, { eager: true }));
    dialogCaption.textContent = memory.caption;
    dialogCounter.textContent = `${index + 1} / ${memories.length}`;
    lastFocused = trigger || document.activeElement;
    if (!dialog.open) dialog.showModal();
    closeButton.focus();
  }

  function closeLightbox() {
    dialog.close();
    lastFocused?.focus?.();
  }

  function navigateLightbox(direction) {
    const nextIndex = (currentIndex + direction + memories.length) % memories.length;
    const nextPage = track.querySelectorAll('.memory-page')[nextIndex];
    const nextTrigger = nextPage?.querySelector('.memory-photo');
    openLightbox(nextIndex, nextTrigger || lastFocused);
  }

  function renderPages() {
    track.replaceChildren();
    memories.forEach((memory, index) => {
      const page = document.createElement('article');
      page.className = 'memory-page';
      page.dataset.chapter = memory.chapter || '';
      page.inert = index !== 0;
      page.setAttribute('aria-hidden', String(index !== 0));

      const tape = document.createElement('span');
      tape.className = 'memory-tape';
      tape.setAttribute('aria-hidden', 'true');

      const photoButton = document.createElement('button');
      photoButton.type = 'button';
      photoButton.className = 'memory-photo';
      photoButton.setAttribute('aria-label', `Mở ảnh: ${memory.alt}`);
      photoButton.tabIndex = index === 0 ? 0 : -1;
      photoButton.append(createPicture(memory, { eager: index < 2 }));
      photoButton.addEventListener('click', () => openLightbox(index, photoButton));

      const copy = document.createElement('div');
      copy.className = 'memory-copy';

      const chapter = document.createElement('p');
      chapter.className = 'memory-chapter';
      chapter.textContent = memory.chapter || 'Một kỷ niệm';

      const caption = document.createElement('h3');
      caption.className = 'memory-caption';
      caption.textContent = memory.caption;

      copy.append(chapter, caption);
      if (memory.date) {
        const date = document.createElement('p');
        date.className = 'memory-date';
        date.textContent = memory.date;
        copy.append(date);
      }

      page.append(tape, photoButton, copy);
      track.append(page);
    });
    rendered = true;
  }

  function handleKeydown(event) {
    if (!active) return;
    if (dialog.open) {
      if (event.key === 'ArrowLeft') navigateLightbox(-1);
      if (event.key === 'ArrowRight') navigateLightbox(1);
      return;
    }
    if (event.key === 'ArrowLeft') goTo(currentIndex - 1);
    if (event.key === 'ArrowRight') goTo(currentIndex + 1);
  }

  function handlePointerDown(event) {
    if (!event.isPrimary || event.button !== 0) return;
    pointerStart = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      captured: false,
    };
  }

  function handlePointerMove(event) {
    if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    if (
      !pointerStart.captured &&
      Math.abs(deltaX) > 8 &&
      Math.abs(deltaX) > Math.abs(deltaY)
    ) {
      pointerStart.captured = true;
      track.classList.add('is-dragging');
      viewport.setPointerCapture?.(event.pointerId);
    }
  }

  function handlePointerUp(event) {
    if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    const wasCaptured = pointerStart.captured;
    const wasCancelled = event.type === 'pointercancel';
    if (wasCaptured && viewport.hasPointerCapture?.(event.pointerId)) {
      viewport.releasePointerCapture?.(event.pointerId);
    }
    track.classList.remove('is-dragging');
    pointerStart = null;
    if (
      !wasCancelled &&
      Math.abs(deltaX) > 45 &&
      Math.abs(deltaX) > Math.abs(deltaY)
    ) {
      goTo(currentIndex + (deltaX < 0 ? 1 : -1));
    }
  }

  closeButton.addEventListener('click', closeLightbox);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeLightbox();
  });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeLightbox();
  });
  viewport.addEventListener('pointerdown', handlePointerDown);
  viewport.addEventListener('pointermove', handlePointerMove);
  viewport.addEventListener('pointerup', handlePointerUp);
  viewport.addEventListener('pointercancel', handlePointerUp);

  return {
    enter({ startAt = currentIndex } = {}) {
      active = true;
      if (!rendered) {
        renderTabs();
        renderPages();
      }
      globalThis.addEventListener('resize', update);
      document.addEventListener('keydown', handleKeydown);
      goTo(startAt);
    },
    exit() {
      active = false;
      globalThis.removeEventListener('resize', update);
      document.removeEventListener('keydown', handleKeydown);
      if (dialog.open) closeLightbox();
    },
    next() {
      goTo(currentIndex + 1);
    },
    previous() {
      goTo(currentIndex - 1);
    },
    lightboxNext() {
      navigateLightbox(1);
    },
    lightboxPrevious() {
      navigateLightbox(-1);
    },
    reset() {
      goTo(0);
    },
    get currentIndex() {
      return currentIndex;
    },
  };
}
