import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inboxDir = process.env.WORKS_INBOX_DIR || path.join(homedir(), 'Desktop', '施工写真投入');
const worksDir = process.env.WORKS_TARGET_DIR || path.join(repoRoot, 'works');
const year = process.env.WORKS_YEAR || String(new Date().getFullYear());
const publish = process.argv.includes('--publish') || process.env.WORKS_PUBLISH === '1';
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
const convertExtensions = new Set(['.heic', '.heif', '.png', '.webp']);
const displayImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const tmpWorkDir = mkdtempSync(path.join(tmpdir(), 'ex-takumi-works-'));

function isImage(name) {
  return imageExtensions.has(path.extname(name).toLowerCase());
}

function assertCommand(command) {
  const result = spawnSync('/bin/zsh', ['-lc', `command -v ${command}`], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`${command} が見つかりません。`);
  }
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

async function readInboxImages() {
  await mkdir(inboxDir, { recursive: true });
  await mkdir(worksDir, { recursive: true });

  const entries = await readdir(inboxDir, { withFileTypes: true });
  const images = [];

  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.') || !isImage(entry.name)) continue;
    const fullPath = path.join(inboxDir, entry.name);
    const stats = await stat(fullPath);
    images.push({ name: entry.name, fullPath, stats });
  }

  return images.sort((a, b) => {
    const timeDiff = a.stats.mtimeMs - b.stats.mtimeMs;
    return timeDiff || a.name.localeCompare(b.name, 'ja');
  });
}

async function nextCaseName() {
  const entries = await readdir(worksDir, { withFileTypes: true });
  const pattern = new RegExp(`^${year}-(\\d{3})$`);
  const numbers = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name.match(pattern)?.[1])
    .filter(Boolean)
    .map(Number);
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `${year}-${String(next).padStart(3, '0')}`;
}

function runSips(source, destination) {
  const result = spawnSync('sips', ['-s', 'format', 'jpeg', source, '--out', destination], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`画像変換に失敗しました: ${path.basename(source)}\n${result.stderr || result.stdout}`);
  }
}

async function createJpegFromImage(image, destination) {
  const extension = path.extname(image.name).toLowerCase();

  if (convertExtensions.has(extension)) {
    runSips(image.fullPath, destination);
    await unlink(image.fullPath);
    return;
  }

  await moveFile(image.fullPath, destination);
}

async function writeInfoJson(targetDir, caseName) {
  const info = {
    name: caseName,
    content: '',
    period: '',
    price: '',
  };
  await writeFile(path.join(targetDir, 'info.json'), `${JSON.stringify(info, null, 2)}\n`, 'utf8');
}

async function readWorkInfo(folderPath, folderName) {
  try {
    const raw = await readFile(path.join(folderPath, 'info.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      name: folderName,
      content: '',
      period: '',
      price: '',
    };
  }
}

async function buildWorkManifest() {
  await mkdir(worksDir, { recursive: true });
  const entries = await readdir(worksDir, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => b.name.localeCompare(a.name, 'ja'));
  const manifest = [];

  for (const folder of folders) {
    const folderPath = path.join(worksDir, folder.name);
    const files = await readdir(folderPath, { withFileTypes: true });
    const images = files
      .filter((file) => file.isFile() && displayImageExtensions.has(path.extname(file.name).toLowerCase()))
      .map((file) => file.name)
      .sort((a, b) => a.localeCompare(b, 'ja'));
    const before = images.find((name) => /^before\./i.test(name));
    const after = images.find((name) => /^after\./i.test(name));
    const orderedImages = [
      before ? { label: '施工前', name: before } : null,
      after ? { label: '施工後', name: after } : null,
      ...images
        .filter((name) => name !== before && name !== after)
        .map((name) => ({ label: '', name })),
    ].filter(Boolean);

    if (!orderedImages.length) continue;

    const info = await readWorkInfo(folderPath, folder.name);
    manifest.push({
      name: info.name || info.title || info.content || info.work || folder.name,
      info,
      photos: orderedImages.map((image) => ({
        label: image.label,
        src: `works/${folder.name}/${image.name}`,
      })),
    });
  }

  await writeFile(path.join(worksDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function git(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} に失敗しました。\n${result.stderr || result.stdout}`);
  }

  return (result.stdout || '').trim();
}

function ensureCleanForPublish() {
  const status = git(['status', '--short']);
  const allowed = status
    .split('\n')
    .filter(Boolean)
    .filter((line) => !line.includes('scripts/import-works.mjs') && !line.includes('scripts/施工写真をHPに追加.command'));

  if (allowed.length) {
    throw new Error(`未コミットの変更があります。先に確認してください。\n${allowed.join('\n')}`);
  }
}

async function importImages() {
  const images = await readInboxImages();

  if (!images.length) {
    console.log('投入フォルダに画像がありません。');
    console.log(`写真をここに入れてください: ${inboxDir}`);
    return [];
  }

  assertCommand('sips');

  const imported = [];
  for (const image of images) {
    const caseName = await nextCaseName();
    const targetDir = path.join(worksDir, caseName);
    await mkdir(targetDir, { recursive: true });

    const targetImage = path.join(targetDir, 'after.jpg');
    await createJpegFromImage(image, targetImage);
    await writeInfoJson(targetDir, caseName);

    imported.push({ caseName, sourceName: image.name, targetDir });
    if (!process.env.WORKS_SKIP_GIT_ADD) {
      git(['add', path.relative(repoRoot, targetDir)]);
    }
  }

  return imported;
}

async function publishChanges(imported) {
  if (!imported.length) return;

  git(['add', 'works']);
  const message = `Add works photos ${imported.map((item) => item.caseName).join(', ')}`;
  git(['commit', '-m', message], { stdio: 'inherit' });
  git(['push', 'origin', 'main'], { stdio: 'inherit' });
}

async function main() {
  if (publish && !process.env.WORKS_SKIP_CLEAN_CHECK) {
    ensureCleanForPublish();
  }

  const imported = await importImages();
  const manifest = await buildWorkManifest();
  if (!process.env.WORKS_SKIP_GIT_ADD) {
    git(['add', path.relative(repoRoot, path.join(worksDir, 'manifest.json'))]);
  }

  for (const item of imported) {
    console.log(`追加しました: works/${item.caseName}/after.jpg`);
    console.log(`  元画像: ${item.sourceName}`);
  }

  console.log(`施工事例manifestを更新しました: ${manifest.length}件`);

  if (!imported.length) {
    console.log('追加写真はありませんでした。');
    return;
  }

  if (publish) {
    await publishChanges(imported);
    console.log('');
    console.log('GitHub Pagesへ反映するための push まで完了しました。');
  } else if (process.env.WORKS_SKIP_GIT_ADD) {
    console.log('');
    console.log('テスト実行のため、Git追加はスキップしました。');
  } else {
    console.log('');
    console.log('Git管理対象へ追加済みです。');
    console.log('公開まで行う場合は、次を実行してください:');
    console.log('node scripts/import-works.mjs --publish');
  }
}

main()
  .catch((error) => {
    console.error('取り込みに失敗しました。');
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (existsSync(tmpWorkDir)) {
      await rm(tmpWorkDir, { recursive: true, force: true });
    }
  });
