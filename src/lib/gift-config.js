const LIMITS = {
  name: 80,
  greeting: 200,
  paragraph: 4_000,
  closing: 200,
  epilogueHeading: 160,
  epilogueMessage: 2_000,
  path: 1_024,
  title: 200,
  lyric: 500,
  id: 100,
  alt: 200,
  caption: 500,
  chapter: 120,
  date: 80,
};

function cleanText(value, maxLength) {
  const text = String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .trim();

  return [...text].slice(0, maxLength).join('');
}

function cleanName(value) {
  const name = String(value ?? '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return [...name].slice(0, LIMITS.name).join('');
}

function normalizeAge(value) {
  const age = Number(value);
  if (!Number.isFinite(age)) {
    return 1;
  }

  return Math.min(120, Math.max(1, Math.trunc(age)));
}

function getIntegerOverride(params, key) {
  const value = params.get(key);
  if (value === null || !/^[+-]?\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function normalizeMemory(memory) {
  const normalized = {
    id: cleanText(memory.id, LIMITS.id),
    src: cleanText(memory.src, LIMITS.path),
    alt: cleanText(memory.alt, LIMITS.alt),
    caption: cleanText(memory.caption, LIMITS.caption),
  };
  const chapter = cleanText(memory.chapter, LIMITS.chapter);
  const date = cleanText(memory.date, LIMITS.date);

  if (chapter) {
    normalized.chapter = chapter;
  }
  if (date) {
    normalized.date = date;
  }

  return normalized;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function textLength(value) {
  return [...value.trim()].length;
}

function validateRequiredText(errors, value, path, maxLength) {
  if (!hasText(value)) {
    errors.push(`${path} must be a non-empty string.`);
    return false;
  }

  if (textLength(value) > maxLength) {
    errors.push(`${path} must be at most ${maxLength} characters.`);
    return false;
  }

  return true;
}

function validateOptionalText(errors, object, key, path, maxLength) {
  if (!(key in object)) {
    return;
  }

  const value = object[key];
  if (!hasText(value)) {
    errors.push(`${path} must be a non-empty string when provided.`);
  } else if (textLength(value) > maxLength) {
    errors.push(`${path} must be at most ${maxLength} characters.`);
  }
}

function isSafePublicPath(value) {
  if (!hasText(value)) {
    return false;
  }

  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return false;
  }

  try {
    const decoded = decodeURIComponent(path);
    return !decoded.split('/').some((segment) => segment === '..')
      && !decoded.includes('\u0000');
  } catch {
    return false;
  }
}

function isSupportedSoundtrackPath(value) {
  return /\.(mp3|m4a|ogg)$/i.test(value.trim());
}

function isSupportedMemoryPath(value) {
  return /^\/images\/[^/]+\.jpg$/i.test(value.trim());
}

function isSafeShareUrl(value) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

function validateObject(errors, value, path) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return false;
  }

  return true;
}

export function normalizeGiftConfig(raw, search = '') {
  const normalized = {
    recipient: {
      name: cleanName(raw.recipient.name),
      age: normalizeAge(raw.recipient.age),
    },
    sender: {
      name: cleanName(raw.sender.name),
    },
    letter: {
      greeting: cleanText(raw.letter.greeting, LIMITS.greeting),
      paragraphs: raw.letter.paragraphs.map((paragraph) => (
        cleanText(paragraph, LIMITS.paragraph)
      )),
      closing: cleanText(raw.letter.closing, LIMITS.closing),
    },
    epilogue: {
      heading: cleanText(raw.epilogue.heading, LIMITS.epilogueHeading),
      message: cleanText(raw.epilogue.message, LIMITS.epilogueMessage),
    },
    giftReveal: {
      productName: cleanText(raw.giftReveal.productName, LIMITS.title),
      articleNumber: cleanText(raw.giftReveal.articleNumber, LIMITS.id),
      src: cleanText(raw.giftReveal.src, LIMITS.path),
      alt: cleanText(raw.giftReveal.alt, LIMITS.alt),
      caption: cleanText(raw.giftReveal.caption, LIMITS.caption),
    },
    soundtrack: {
      src: cleanText(raw.soundtrack.src, LIMITS.path),
      title: cleanText(raw.soundtrack.title, LIMITS.title),
      loop: raw.soundtrack.loop,
      lyrics: raw.soundtrack.lyrics.map((line) => ({
        time: line.time,
        text: cleanText(line.text, LIMITS.lyric),
      })),
    },
    features: {
      cameraGestures: raw.features.cameraGestures,
      manualPhotoUpload: raw.features.manualPhotoUpload,
      lyrics: raw.features.lyrics,
      postcard: raw.features.postcard,
      voiceNote: raw.features.voiceNote,
    },
    memories: raw.memories.map(normalizeMemory),
  };

  const params = new URLSearchParams(
    typeof search === 'string' && search.startsWith('?') ? search.slice(1) : search,
  );
  const recipientOverride = cleanName(params.get('to'));
  const senderOverride = cleanName(params.get('from'));
  const ageOverride = getIntegerOverride(params, 'age');

  if (recipientOverride) {
    normalized.recipient.name = recipientOverride;
  }
  if (senderOverride) {
    normalized.sender.name = senderOverride;
  }
  if (ageOverride !== null) {
    normalized.recipient.age = normalizeAge(ageOverride);
  }

  return normalized;
}

export function validateGiftConfig(raw) {
  if (!isRecord(raw)) {
    return ['gift config must be an object.'];
  }

  const errors = [];

  if (validateObject(errors, raw.recipient, 'recipient')) {
    validateRequiredText(
      errors,
      raw.recipient.name,
      'recipient.name',
      LIMITS.name,
    );
    if (
      !Number.isInteger(raw.recipient.age)
      || raw.recipient.age < 1
      || raw.recipient.age > 120
    ) {
      errors.push('recipient.age must be an integer from 1 to 120.');
    }
  }

  if (validateObject(errors, raw.sender, 'sender')) {
    validateRequiredText(errors, raw.sender.name, 'sender.name', LIMITS.name);
  }

  if (validateObject(errors, raw.letter, 'letter')) {
    validateRequiredText(
      errors,
      raw.letter.greeting,
      'letter.greeting',
      LIMITS.greeting,
    );
    if (!Array.isArray(raw.letter.paragraphs) || raw.letter.paragraphs.length === 0) {
      errors.push('letter.paragraphs must be a non-empty array.');
    } else {
      raw.letter.paragraphs.forEach((paragraph, index) => {
        validateRequiredText(
          errors,
          paragraph,
          `letter.paragraphs[${index}]`,
          LIMITS.paragraph,
        );
      });
    }
    validateRequiredText(
      errors,
      raw.letter.closing,
      'letter.closing',
      LIMITS.closing,
    );
  }

  if (validateObject(errors, raw.epilogue, 'epilogue')) {
    validateRequiredText(
      errors,
      raw.epilogue.heading,
      'epilogue.heading',
      LIMITS.epilogueHeading,
    );
    validateRequiredText(
      errors,
      raw.epilogue.message,
      'epilogue.message',
      LIMITS.epilogueMessage,
    );
  }

  if (validateObject(errors, raw.giftReveal, 'giftReveal')) {
    validateRequiredText(
      errors,
      raw.giftReveal.productName,
      'giftReveal.productName',
      LIMITS.title,
    );
    validateRequiredText(
      errors,
      raw.giftReveal.articleNumber,
      'giftReveal.articleNumber',
      LIMITS.id,
    );
    const giftRevealPathIsText = validateRequiredText(
      errors,
      raw.giftReveal.src,
      'giftReveal.src',
      LIMITS.path,
    );
    if (giftRevealPathIsText) {
      if (!isSafePublicPath(raw.giftReveal.src)) {
        errors.push('giftReveal.src must be a safe root-relative public path.');
      } else if (!isSupportedMemoryPath(raw.giftReveal.src)) {
        errors.push('giftReveal.src must reference a JPG inside /images/.');
      }
    }
    validateRequiredText(
      errors,
      raw.giftReveal.alt,
      'giftReveal.alt',
      LIMITS.alt,
    );
    validateRequiredText(
      errors,
      raw.giftReveal.caption,
      'giftReveal.caption',
      LIMITS.caption,
    );
  }

  if (validateObject(errors, raw.soundtrack, 'soundtrack')) {
    const soundtrackPathIsText = validateRequiredText(
      errors,
      raw.soundtrack.src,
      'soundtrack.src',
      LIMITS.path,
    );
    if (soundtrackPathIsText) {
      if (!isSafePublicPath(raw.soundtrack.src)) {
        errors.push('soundtrack.src must be a safe root-relative public path.');
      } else if (!isSupportedSoundtrackPath(raw.soundtrack.src)) {
        errors.push('soundtrack.src must reference an MP3, M4A, or OGG file.');
      }
    }
    validateRequiredText(
      errors,
      raw.soundtrack.title,
      'soundtrack.title',
      LIMITS.title,
    );
    if (typeof raw.soundtrack.loop !== 'boolean') {
      errors.push('soundtrack.loop must be a boolean.');
    }

    if (!Array.isArray(raw.soundtrack.lyrics) || raw.soundtrack.lyrics.length === 0) {
      errors.push('soundtrack.lyrics must be a non-empty array.');
    } else {
      let previousTime = -1;
      raw.soundtrack.lyrics.forEach((line, index) => {
        const path = `soundtrack.lyrics[${index}]`;
        if (!validateObject(errors, line, path)) {
          return;
        }

        if (typeof line.time !== 'number' || !Number.isFinite(line.time) || line.time < 0) {
          errors.push(`${path}.time must be a non-negative number.`);
        } else {
          if (line.time < previousTime) {
            errors.push(`${path}.time must not be earlier than the previous lyric.`);
          }
          previousTime = line.time;
        }
        validateRequiredText(errors, line.text, `${path}.text`, LIMITS.lyric);
      });
    }
  }

  if (validateObject(errors, raw.features, 'features')) {
    [
      'cameraGestures',
      'manualPhotoUpload',
      'lyrics',
      'postcard',
      'voiceNote',
    ].forEach((feature) => {
      if (typeof raw.features[feature] !== 'boolean') {
        errors.push(`features.${feature} must be a boolean.`);
      }
    });
  }

  if ('sharing' in raw && validateObject(errors, raw.sharing, 'sharing')) {
    const shareUrlIsText = validateRequiredText(
      errors,
      raw.sharing.publicUrl,
      'sharing.publicUrl',
      LIMITS.path,
    );
    if (shareUrlIsText && !isSafeShareUrl(raw.sharing.publicUrl)) {
      errors.push(
        'sharing.publicUrl must be an HTTPS URL without credentials, query parameters, or a fragment.',
      );
    }
  }

  if (!Array.isArray(raw.memories) || raw.memories.length === 0) {
    errors.push('memories must be a non-empty array.');
  } else {
    const memoryIds = new Map();
    raw.memories.forEach((memory, index) => {
      const path = `memories[${index}]`;
      if (!validateObject(errors, memory, path)) {
        return;
      }

      const idIsText = validateRequiredText(
        errors,
        memory.id,
        `${path}.id`,
        LIMITS.id,
      );
      if (idIsText) {
        const id = memory.id.trim();
        if (memoryIds.has(id)) {
          errors.push(
            `${path}.id duplicates memories[${memoryIds.get(id)}].id ("${id}").`,
          );
        } else {
          memoryIds.set(id, index);
        }
      }

      const memoryPathIsText = validateRequiredText(
        errors,
        memory.src,
        `${path}.src`,
        LIMITS.path,
      );
      if (memoryPathIsText) {
        if (!isSafePublicPath(memory.src)) {
          errors.push(`${path}.src must be a safe root-relative public path.`);
        } else if (!isSupportedMemoryPath(memory.src)) {
          errors.push(`${path}.src must reference a JPG inside /images/.`);
        }
      }
      validateRequiredText(errors, memory.alt, `${path}.alt`, LIMITS.alt);
      validateRequiredText(
        errors,
        memory.caption,
        `${path}.caption`,
        LIMITS.caption,
      );
      validateOptionalText(
        errors,
        memory,
        'chapter',
        `${path}.chapter`,
        LIMITS.chapter,
      );
      validateOptionalText(
        errors,
        memory,
        'date',
        `${path}.date`,
        LIMITS.date,
      );
    });
  }

  return errors;
}
