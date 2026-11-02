const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/scripts/Toolbox/ImageRenameByFilter.js'), 'utf8').replace(/^#.*$/gm, '');
new vm.Script(source);
const context = vm.createContext({});
for (const name of ['trimString', 'sanitizeViewId', 'sanitizeOptionalSuffix', 'suffixViewId', 'amendSuffixViewId', 'allocateViewId']) {
  const start = source.indexOf('function ' + name + '(');
  let end = source.indexOf('{', start) + 1;
  let depth = 1;
  while (depth) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  vm.runInContext(source.slice(start, end), context);
}
for (const [id, separator, suffix, expected] of [
  ['M31_old', '_', 'new', 'M31_new'],
  ['M31_L_old', '_', 'new', 'M31_new'],
  ['M31', '_', 'new', 'M31_new'],
  ['M31__old', '__', 'new', 'M31__new'],
  ['M31_old', '_', 'new text', 'M31_new_text'],
  ['M31_old', '_', 'old', 'M31_old'],
  ['AstroImagePrimer_B_Oiii_PostLinearFit', '_', '_PostLinearFit', 'AstroImagePrimer__PostLinearFit'],
]) assert.equal(context.amendSuffixViewId(id, separator, suffix), expected);
assert.throws(() => context.amendSuffixViewId('M31_old', '', 'new'));
assert.throws(() => context.amendSuffixViewId('M31_old', '_', '   '));
assert.equal(context.suffixViewId('M31_old', 'new'), 'M31_old_new');
assert.equal(context.allocateViewId('AstroImagePrimer__PostLinearFit', {}, 'source', true), 'AstroImagePrimer__PostLinearFit');
assert.equal(context.allocateViewId('AstroImagePrimer__PostLinearFit', {'AstroImagePrimer__PostLinearFit': true}, 'source', true), 'AstroImagePrimer__PostLinearFit_2');
console.log('Script syntax and 12 suffix checks passed.');
