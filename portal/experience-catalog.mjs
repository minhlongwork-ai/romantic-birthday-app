import { groupExperiencesByYear } from '../scripts/experience-registry.mjs';

const VIETNAMESE_MONTHS = [
  'Tháng Một',
  'Tháng Hai',
  'Tháng Ba',
  'Tháng Tư',
  'Tháng Năm',
  'Tháng Sáu',
  'Tháng Bảy',
  'Tháng Tám',
  'Tháng Chín',
  'Tháng Mười',
  'Tháng Mười Một',
  'Tháng Mười Hai',
];

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]);
}

export function formatVietnameseMonth(month) {
  return VIETNAMESE_MONTHS[month - 1] ?? `Tháng ${month}`;
}

function renderExperienceCard(record, { isPriority = false, allowDraftInteraction = false } = {}) {
  const id = escapeHtml(record.id);
  const descriptionId = `${id}-description`;
  const cardClass = `gift-card gift-card-${id}`;
  const image = `
    <figure class="gift-media">
      <img
        src="${escapeHtml(record.preview.publicPath)}"
        alt="${escapeHtml(record.preview.alt)}"
        width="${escapeHtml(record.preview.width)}"
        height="${escapeHtml(record.preview.height)}"
        ${isPriority ? 'fetchpriority="high"' : 'loading="lazy"'}
      />
      <span class="media-fallback" aria-hidden="true">${escapeHtml(record.title)}</span>
    </figure>`;
  const copy = `
    <span class="gift-copy">
      <span class="gift-month">${escapeHtml(formatVietnameseMonth(record.month))}</span>
      <span class="gift-kind">${escapeHtml(record.kind)}</span>
      <span class="gift-title" role="heading" aria-level="3">${escapeHtml(record.title)}</span>
      <span id="${descriptionId}" class="gift-description">${escapeHtml(record.description)}</span>`;

  if (record.status === 'published' || allowDraftInteraction) {
    const actionLabel = record.status === 'published'
      ? record.actionLabel
      : 'Xem bản tương tác';
    return `
      <a
        class="${cardClass}"
        href="${escapeHtml(record.route)}"
        data-project-link
        aria-describedby="${descriptionId}"
      >${image}${copy}
        <span class="gift-action">
          ${escapeHtml(actionLabel)}
          <span class="gift-arrow" aria-hidden="true">&#8594;</span>
        </span>
      </span>
      </a>`;
  }

  return `
    <article class="${cardClass}" aria-disabled="true" aria-describedby="${descriptionId}">${image}${copy}
      <span class="sr-only">Thiệp này hiện chưa thể mở.</span>
    </span>
    </article>`;
}

export function renderExperienceCatalog(records, options = {}) {
  const experienceYears = groupExperiencesByYear(records);
  const priorityExperienceId = experienceYears
    .flatMap(({ experiences }) => experiences)
    .find(record => record.status === 'published')?.id;

  return experienceYears.map(({ year, experiences }) => `
    <section class="experience-year" aria-labelledby="experience-year-${escapeHtml(year)}">
      <h2 id="experience-year-${escapeHtml(year)}" class="experience-year-title">${escapeHtml(year)}</h2>
      <div class="gift-options">
        ${experiences.map(record => renderExperienceCard(record, {
          isPriority: record.id === priorityExperienceId,
          allowDraftInteraction: Boolean(options.allowDraftInteraction),
        })).join('')}
      </div>
    </section>
  `).join('');
}
