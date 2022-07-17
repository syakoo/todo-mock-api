const fs = require('fs');
const path = require('path');

const commitMessageFilePath = path.resolve(__dirname, '../.git/COMMIT_EDITMSG');

const prefix2Emojis = {
  feat: '✨',
  fix: '🐛',
  docs: '📝',
  refactor: '♻️',
  test: '✅',
  perf: '⚡️',
  chore: '🔧',
  merge: '🔀',
  revert: '⏪',
  build: '🏗',
  ci: '💚',
  version: '🎉',
};

function run() {
  const message = fs.readFileSync(commitMessageFilePath, 'utf-8').trim();
  const messagePrefix = message.split(':')[0];

  if (messagePrefix) {
    const emoji = prefix2Emojis[messagePrefix];

    if (emoji) {
      fs.writeFileSync(commitMessageFilePath, `${emoji} ${message}`, 'utf-8');
    }
  }
}

run();
process.exit();
