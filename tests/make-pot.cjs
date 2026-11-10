// Writes languages/wp-banner.pot: every translatable string in the plugin's PHP (__(), _e(), esc_html__(), esc_attr__(), their
// _e forms, _x() with its context) with the files and lines it is used at and its translators: comment, and the plugin's header.
// Run it after changing a text: npm run pot. tests/settings.php checks the file has every string.
// The editor's own texts (assets/js/admin.js) are not translatable yet: they are plain strings in the script.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const files = ['wp-banner.php', 'uninstall.php'].concat(fs.readdirSync(path.join(ROOT, 'includes')).filter(f => f.endsWith('.php')).map(f => 'includes/' + f));
const STR = String.raw`'((?:[^'\\]|\\.)*)'`;
const CALL = new RegExp(String.raw`\b(__|_e|esc_html__|esc_html_e|esc_attr__|esc_attr_e|_x|esc_html_x|esc_attr_x)\(\s*` + STR + String.raw`(?:\s*,\s*` + STR + ')?' + String.raw`\s*,\s*'wp-banner'`, 'g');
const unq = s => s.replace(/\\(['\\])/g, '$1');
const po = s => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
const entries = new Map();
function add(msgid, ctx, ref, comment) {
  const key = (ctx || '') + '\u0004' + msgid;
  if (!entries.has(key)) entries.set(key, {msgid, ctx, refs:[], comments:new Set()});
  const e = entries.get(key);
  e.refs.push(ref);
  if (comment) e.comments.add(comment);
}
const main = fs.readFileSync(path.join(ROOT, 'wp-banner.php'), 'utf8');
for (const field of ['Plugin Name', 'Plugin URI', 'Description', 'Author', 'Author URI']) {
  const m = new RegExp('^\\s*\\*\\s*' + field + ':\\s*(.+)$', 'm').exec(main);
  if (m) add(m[1].trim(), null, 'wp-banner.php', field + ' of the plugin');
}
for (const file of files) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const m of src.matchAll(CALL)) {
    const isX = /_x$/.test(m[1]);
    // _x('text', 'context', 'wp-banner'); the others ('text', 'wp-banner'): a second string would be another call's.
    if (!isX && m[3] !== undefined) continue;
    const line = src.slice(0, m.index).split('\n').length;
    // A translators: comment on the line before (or earlier on the same one).
    const before = src.slice(0, m.index).split('\n').slice(-2).join('\n');
    const c = /\/\*\s*translators:\s*([\s\S]*?)\*\//.exec(before) || /\/\/\s*translators:\s*(.*)$/m.exec(before);
    add(unq(m[2]), isX ? unq(m[3]) : null, file + ':' + line, c ? 'translators: ' + c[1].trim() : '');
  }
}
const version = (/^\s*\*\s*Version:\s*(\S+)/m.exec(main) || [])[1] || '';
let out = '# Copyright (C) Relevant AS\n# This file is distributed under the GPL-2.0-or-later.\nmsgid ""\nmsgstr ""\n'
  + po('Project-Id-Version: WP Banner ' + version + '\n') + '\n' + po('Report-Msgid-Bugs-To: https://github.com/Andrusi4ka/WP-Banner/issues\n') + '\n'
  + po('MIME-Version: 1.0\n') + '\n' + po('Content-Type: text/plain; charset=UTF-8\n') + '\n' + po('Content-Transfer-Encoding: 8bit\n') + '\n'
  + po('X-Domain: wp-banner\n') + '\n';
for (const e of entries.values()) {
  out += '\n';
  for (const c of e.comments) out += '#. ' + c.replace(/\n/g, ' ') + '\n';
  out += '#: ' + e.refs.join(' ') + '\n';
  if (e.ctx) out += 'msgctxt ' + po(e.ctx) + '\n';
  out += 'msgid ' + po(e.msgid) + '\nmsgstr ""\n';
}
fs.mkdirSync(path.join(ROOT, 'languages'), {recursive:true});
fs.writeFileSync(path.join(ROOT, 'languages', 'wp-banner.pot'), out);
console.log('languages/wp-banner.pot: ' + entries.size + ' strings');
