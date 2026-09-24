const db = require('./db');
const channelsDb = require('./db/channels');
const videosDb = require('./db/videos');
const sentencesDb = require('./db/sentences');

const APP_ID = 'study-ted';
const EXPORT_VERSION = 1;

function buildDataset(options = {}) {
  const scope = options.scope ?? 'all';
  const filter = { limit: 100000 };
  if (scope === 'favorites') filter.favoriteOnly = true;
  if (scope && scope.startsWith('channel:')) filter.channelPk = Number(scope.split(':')[1]);
  const sentences = db.tx(() => sentencesDb.list(filter).items);
  const videoIds = [...new Set(sentences.map((row) => row.videoId).filter(Boolean))];
  const channelPks = [...new Set(sentences.map((row) => row.channelPk).filter(Boolean))];
  const videos = videoIds.map((videoId) => videosDb.getByVideoId(videoId)).filter(Boolean);
  const channels = channelPks.map((pk) => channelsDb.getByPk(pk)).filter(Boolean);
  return {
    app: APP_ID,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    scope,
    counts: { channels: channels.length, videos: videos.length, sentences: sentences.length },
    channels: channels.map((channel) => ({
      channelId: channel.channelId,
      handle: channel.handle,
      title: channel.title,
      url: channel.url,
      avatarUrl: channel.avatarUrl,
      description: channel.description,
    })),
    videos: videos.map((video) => ({
      videoId: video.videoId,
      channelId: video.channelId,
      title: video.title,
      url: video.url,
      durationText: video.durationText,
      viewCountText: video.viewCountText,
      publishedText: video.publishedText,
      thumbnailUrl: video.thumbnailUrl,
    })),
    sentences: sentences.map((row) => ({
      sentence: row.sentence,
      translation: row.translation,
      analysis: row.analysis,
      source: row.source,
      startSec: row.startSec,
      isFavorite: row.isFavorite,
      createdAt: row.createdAt,
      videoId: row.videoId,
      videoTitle: row.videoTitle,
      videoUrl: row.videoUrl,
    })),
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatAnalysis(analysis) {
  if (!analysis) return [];
  const lines = [];
  if (analysis.translation) lines.push(`해석: ${analysis.translation}`);
  for (const item of analysis.structure ?? []) {
    lines.push(`구문: ${[item.part, item.meaning, item.note].filter(Boolean).join(' — ')}`);
  }
  return lines;
}

function toMarkdown(dataset) {
  const lines = [
    '# Study TED — 학습한 문장',
    '',
    `- 내보낸 시각: ${dataset.exportedAt}`,
    `- 문장 ${dataset.counts.sentences}개 · 영상 ${dataset.counts.videos}개 · 채널 ${dataset.counts.channels}개`,
    '',
  ];
  const groups = new Map();
  for (const row of dataset.sentences) {
    const key = row.videoTitle ?? '출처 없음';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const [videoTitle, rows] of groups) {
    const url = rows[0].videoUrl ?? '';
    lines.push(`## ${videoTitle}${url ? ` — ${url}` : ''}`, '');
    rows.forEach((row, index) => {
      lines.push(`${index + 1}. **${row.sentence}**`);
      if (row.translation) lines.push(`   - 해석: ${row.translation}`);
      for (const extra of formatAnalysis(row.analysis)) lines.push(`   - ${extra}`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

function toHtml(dataset) {
  const rows = dataset.sentences
    .map(
      (row) => `
      <article class="card">
        <p class="en">${escapeHtml(row.sentence)}</p>
        ${row.translation ? `<p class="ko">${escapeHtml(row.translation)}</p>` : ''}
        <p class="src">${escapeHtml(row.videoTitle ?? '')}${row.videoUrl ? ` · <a href="${escapeHtml(row.videoUrl)}">영상 열기</a>` : ''}</p>
        ${formatAnalysis(row.analysis).length ? `<ul>${formatAnalysis(row.analysis).map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : ''}
      </article>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>Study TED — 학습한 문장</title>
<style>
  body { font-family: "Malgun Gothic", system-ui, sans-serif; background: #f0f6f6; color: #1a2233; margin: 0; padding: 32px; }
  h1 { font-size: 22px; }
  .meta { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
  .card { background: #fcfcfc; border: 1px solid #e5e9f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .en { font-size: 16px; font-weight: 600; margin: 0 0 6px; }
  .ko { color: #45536b; margin: 0 0 6px; }
  .src { color: #6b7280; font-size: 12px; margin: 6px 0; }
  ul { margin: 6px 0 0 18px; color: #45536b; font-size: 13px; }
</style>
</head>
<body>
<h1>Study TED — 학습한 문장</h1>
<p class="meta">내보낸 시각 ${escapeHtml(dataset.exportedAt)} · 문장 ${dataset.counts.sentences}개</p>
${rows}
</body>
</html>`;
}

function toCsv(dataset) {
  const header = ['문장', '해석', '출처(영상 제목)', '영상 주소', '저장일', '즐겨찾기'];
  const lines = [header.join(',')];
  for (const row of dataset.sentences) {
    lines.push(
      [
        row.sentence,
        row.translation ?? '',
        row.videoTitle ?? '',
        row.videoUrl ?? '',
        row.createdAt ?? '',
        row.isFavorite ? 'Y' : '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

function serialize(dataset, format) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'md') {
    return { content: toMarkdown(dataset), mime: 'text/markdown', filename: `study-ted-${stamp}.md` };
  }
  if (format === 'html') {
    return { content: toHtml(dataset), mime: 'text/html', filename: `study-ted-${stamp}.html` };
  }
  if (format === 'csv') {
    return { content: toCsv(dataset), mime: 'text/csv', filename: `study-ted-${stamp}.csv` };
  }
  return { content: JSON.stringify(dataset, null, 2), mime: 'application/json', filename: `study-ted-${stamp}.json` };
}

function parseImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON 파일을 해석하지 못했습니다: ${error.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sentences)) {
    throw new Error('Study TED 내보내기 파일 형식이 아닙니다.');
  }
  return parsed;
}

function normalizeKey(sentence) {
  return String(sentence ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function mergeImport(dataset) {
  const summary = { added: 0, merged: 0, skipped: 0, videosCreated: 0, channelsCreated: 0 };
  const channelByExternalId = new Map();
  for (const channel of dataset.channels ?? []) {
    if (!channel?.channelId) continue;
    const existing = channelsDb.getByChannelId(channel.channelId);
    const row = channelsDb.upsert({
      channelId: channel.channelId,
      handle: channel.handle ?? null,
      title: channel.title ?? channel.channelId,
      url: channel.url ?? `https://www.youtube.com/channel/${channel.channelId}`,
      avatarUrl: channel.avatarUrl ?? null,
      description: channel.description ?? null,
    });
    channelByExternalId.set(channel.channelId, row);
    if (!existing) summary.channelsCreated += 1;
  }
  for (const video of dataset.videos ?? []) {
    if (!video?.videoId) continue;
    const existing = videosDb.getByVideoId(video.videoId);
    videosDb.upsert({
      videoId: video.videoId,
      channelPk: channelByExternalId.get(video.channelId)?.pk ?? null,
      channelId: video.channelId ?? null,
      title: video.title ?? video.videoId,
      url: video.url ?? `https://www.youtube.com/watch?v=${video.videoId}`,
      durationText: video.durationText ?? null,
      viewCountText: video.viewCountText ?? null,
      publishedText: video.publishedText ?? null,
      thumbnailUrl: video.thumbnailUrl ?? null,
    });
    if (!existing) summary.videosCreated += 1;
  }

  const existingRows = sentencesDb.list({ limit: 100000 }).items;
  const index = new Map();
  for (const row of existingRows) {
    index.set(`${row.videoId ?? ''}::${normalizeKey(row.sentence)}`, row);
  }

  for (const entry of dataset.sentences) {
    if (!entry?.sentence) {
      summary.skipped += 1;
      continue;
    }
    const videoId = entry.videoId ?? '';
    const key = `${videoId}::${normalizeKey(entry.sentence)}`;
    const found = index.get(key);
    const videoRow = videoId ? videosDb.getByVideoId(videoId) : null;
    if (found) {
      sentencesDb.update(found.pk, {
        translation: found.translation ?? entry.translation ?? null,
        analysis: found.analysis ?? entry.analysis ?? null,
      });
      summary.merged += 1;
      continue;
    }
    const created = sentencesDb.create({
      sentence: entry.sentence,
      translation: entry.translation ?? null,
      analysis: entry.analysis ?? null,
      source: entry.source ?? 'import',
      startSec: entry.startSec ?? null,
      isFavorite: entry.isFavorite ? 1 : 0,
      videoPk: videoRow?.pk ?? null,
      videoId: videoId || null,
      videoTitle: entry.videoTitle ?? videoRow?.title ?? null,
      videoUrl: entry.videoUrl ?? videoRow?.url ?? null,
      channelPk: videoRow?.channelPk ?? null,
    });
    index.set(key, created);
    summary.added += 1;
  }
  return summary;
}

module.exports = { APP_ID, buildDataset, serialize, parseImport, mergeImport, toMarkdown, toHtml, toCsv };
