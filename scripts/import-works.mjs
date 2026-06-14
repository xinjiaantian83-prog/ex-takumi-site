import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  copyFile,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inboxDir = process.env.WORKS_INBOX_DIR || path.join(homedir(), 'Desktop', '施工写真投入');
const worksDir = process.env.WORKS_TARGET_DIR || path.join(repoRoot, 'works');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const beforeWords = ['before', '施工前', 'ビフォー', 'まえ', '前'];
const afterWords = ['after', '施工後', '完成', 'アフター', 'あと', '後'];

function normalizeName(name) {
  return name.toLowerCase().normalize('NFKC');
}

function isImage(name) {
  return imageExtensions.has(path.extname(name).toLowerCase());
}

function includesAny(name, words) {
  const normalized = normalizeName(name);
  return words.some((word) => normalized.includes(normalizeName(word)));
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function safeFolderName(name) {
  return normalizeName(name)
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function uniqueWorkDir(baseName) {
  let candidate = path.join(worksDir, baseName);
  let count = 2;

  while (existsSync(candidate)) {
    candidate = path.join(worksDir, `${baseName}-${count}`);
    count += 1;
  }

  return candidate;
}

async function moveFile(source, destination) {
  try {
    await rename(source, destination);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await copyFile(source, destination);
    await unlink(source);
  }
}

async function readEntries(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    const stats = await stat(fullPath);
    result.push({ entry, fullPath, stats });
  }

  return result;
}

async function buildGroups() {
  await mkdir(inboxDir, { recursive: true });
  await mkdir(worksDir, { recursive: true });

  const entries = await readEntries(inboxDir);
  const rootImages = entries.filter((item) => item.entry.isFile() && isImage(item.entry.name));
  const rootInfo = entries.find((item) => item.entry.isFile() && item.entry.name.toLowerCase() === 'info.json');
  const folders = entries.filter((item) => item.entry.isDirectory());
  const groups = [];

  if (rootImages.length) {
    groups.push({
      name: formatTimestamp(),
      sourceDir: inboxDir,
      images: rootImages,
      infoFile: rootInfo,
      removeSourceDir: false,
    });
  }

  for (const folder of folders) {
    const children = await readEntries(folder.fullPath);
    const images = children.filter((item) => item.entry.isFile() && isImage(item.entry.name));
    if (!images.length) continue;

    groups.push({
      name: `${formatTimestamp()}-${safeFolderName(folder.entry.name) || 'work'}`,
      sourceDir: folder.fullPath,
      images,
      infoFile: children.find((item) => item.entry.isFile() && item.entry.name.toLowerCase() === 'info.json'),
      removeSourceDir: true,
    });
  }

  return groups;
}

function decideDestinations(images) {
  const sorted = [...images].sort((a, b) => {
    const timeDiff = a.stats.mtimeMs - b.stats.mtimeMs;
    return timeDiff || a.entry.name.localeCompare(b.entry.name, 'ja');
  });
  const assigned = new Map();
  const used = new Set();

  const before = sorted.find((item) => includesAny(item.entry.name, beforeWords));
  const after = sorted.find((item) => includesAny(item.entry.name, afterWords));

  if (before) {
    assigned.set(before.fullPath, 'before');
    used.add(before.fullPath);
  }

  if (after && !used.has(after.fullPath)) {
    assigned.set(after.fullPath, 'after');
    used.add(after.fullPath);
  }

  if (!before && !after && sorted.length === 1) {
    assigned.set(sorted[0].fullPath, 'after');
    used.add(sorted[0].fullPath);
  }

  if (!before && !after && sorted.length >= 2) {
    assigned.set(sorted[0].fullPath, 'before');
    used.add(sorted[0].fullPath);
    assigned.set(sorted[sorted.length - 1].fullPath, 'after');
    used.add(sorted[sorted.length - 1].fullPath);
  }

  let photoCount = 1;
  return sorted.map((item) => {
    const ext = path.extname(item.entry.name).toLowerCase();
    const role = assigned.get(item.fullPath);
    const basename = role || `photo-${String(photoCount++).padStart(2, '0')}`;
    return {
      source: item.fullPath,
      destinationName: `${basename}${ext}`,
      originalName: item.entry.name,
    };
  });
}

async function ensureInfoFile(group, targetDir) {
  const targetInfo = path.join(targetDir, 'info.json');

  if (group.infoFile) {
    await moveFile(group.infoFile.fullPath, targetInfo);
    return;
  }

  const template = {
    name: '',
    content: '',
    period: '',
    price: '',
  };
  await writeFile(targetInfo, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
}

async function importGroup(group) {
  const targetDir = await uniqueWorkDir(group.name);
  await mkdir(targetDir, { recursive: true });

  const destinations = decideDestinations(group.images);
  for (const item of destinations) {
    await moveFile(item.source, path.join(targetDir, item.destinationName));
  }

  await ensureInfoFile(group, targetDir);

  if (group.removeSourceDir) {
    await rm(group.sourceDir, { recursive: true, force: true });
  }

  const relativeTarget = path.relative(repoRoot, targetDir);
  if (!process.env.WORKS_SKIP_GIT_ADD) {
    spawnSync('git', ['add', relativeTarget], { cwd: repoRoot, stdio: 'ignore' });
  }

  return { targetDir, destinations };
}

async function main() {
  const groups = await buildGroups();

  if (!groups.length) {
    console.log('投入フォルダに画像がありません。');
    console.log(`写真をここに入れてください: ${inboxDir}`);
    return;
  }

  console.log(`投入フォルダ: ${inboxDir}`);
  console.log('');

  for (const group of groups) {
    const result = await importGroup(group);
    console.log(`追加しました: ${path.relative(repoRoot, result.targetDir)}`);
    for (const file of result.destinations) {
      console.log(`  ${file.originalName} -> ${file.destinationName}`);
    }
    console.log('');
  }

  if (process.env.WORKS_SKIP_GIT_ADD) {
    console.log('テスト実行のため、Git追加はスキップしました。');
  } else {
    console.log('Git管理対象へ追加済みです。');
    console.log('内容確認後、Codexに「コミットしてプッシュ」と依頼してください。');
  }
}

main().catch((error) => {
  console.error('取り込みに失敗しました。');
  console.error(error);
  process.exitCode = 1;
});
