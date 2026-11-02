const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/scripts/Toolbox/ImageRenameByFilter.js'), 'utf8').replace(/^#.*$/gm, '');
new vm.Script(source);
const context = vm.createContext({});
for (const name of ['trimString', 'sanitizeViewId', 'sanitizeOptionalSuffix', 'suffixViewId', 'amendSuffixViewId', 'allocateViewId', 'wildcardRenameViewId', 'buildPlan']) {
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

for (const [id, find, replacement, expected] of [
 ['AstroImagePrimer_B_Oiii_PostLinearFit', 'AstroImagePrimer', 'Fitted', 'Fitted_B_Oiii_PostLinearFit'],
 ['AstroImagePrimer__PostLinearFit', 'AstroImagePrimer', 'Fitted', 'Fitted__PostLinearFit'],
 ['M31_Oiii_old', 'M31_*_old', 'Fitted', 'Fitted'],
 ['M31_B_old', '?31', 'Fitted', 'Fitted_B_old'],
 ['M31_B_old', 'm31', 'Fitted', null],
 ['M31_B_old', 'missing', 'Fitted', null],
 ['M31_B_old', '_old', '', 'M31_B'],
 ['M31_B_old', 'M31', 'New Name', 'New_Name_B_old'],
 ['M31_M31', 'M31', 'Fitted', 'Fitted_M31'],
 ['M31', '*', '$&', '__'],
 ['M31', 'M.1', 'Fitted', null],
]) assert.equal(context.wildcardRenameViewId(id, find, replacement), expected);
for (const literal of ['.', '+', '[', ']', '(', ')', '{', '}', '^', '$', '|', String.fromCharCode(92)]) {
 assert.equal(context.wildcardRenameViewId('M' + literal + '31', literal, '_'), 'M_31');
 assert.equal(context.wildcardRenameViewId('M31', literal, '_'), null);
}
assert.throws(() => context.wildcardRenameViewId('M31', '', 'Fitted'));
assert.throws(() => context.wildcardRenameViewId('M31', '*', ''));
console.log('Wildcard replacement, glob matching, literal escaping, and validation checks passed.');

context.ImageWindow = { windows: [
 {mainView: {id: 'AstroImagePrimer_B'}},
 {mainView: {id: 'Unmatched_B'}},
 {mainView: {id: 'AstroImagePrimer__L'}}
] };
context.existingViewIds = () => ({Fitted_B: true});
context.findMapping = () => ({imageId: 'MappingMustBeIgnored'});
context.windowFilePath = () => '';
context.isCollapsedWindow = () => false;
context.directoryOfPath = () => '';
context.extensionOfPath = () => '';
const plan = context.buildPlan([], '', {AstroImagePrimer_B: false}, 'wildcard', '_', 'AstroImagePrimer', 'Fitted');
assert.equal(plan[0].newId, 'Fitted_B_2');
assert.equal(plan[0].selected, false);
assert.equal(plan[0].mapping.suffixOnly, true);
assert.equal(plan[1].mapping, null);
assert.equal(plan[1].newId, '');
assert.equal(plan[2].newId, 'Fitted__L');
console.log('Batch plan collision handling, selection preservation, copy-save mode, and unmatched exclusion passed.');
