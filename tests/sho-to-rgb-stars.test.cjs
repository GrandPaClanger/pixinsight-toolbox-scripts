// Contract tests with PJSR doubles. Run: node --test tests/*.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function runtime() {
  const windows = [];
  const context = {
    Sizer: function () {}, Dialog: function () {},
    View: { viewById: id => windows.find(w => w.mainView.id === id)?.mainView || { isNull: true } },
    ImageWindow: function (width, height, channels, bits, real, color, id) {
      const window = { isNull: false, mainView: { id, image: { width, height,
        numberOfChannels: channels, isColor: color, isComplex: false } },
        show() { this.shown = true; },
        forceClose() { this.closed = true; windows.splice(windows.indexOf(this), 1); } };
      windows.push(window);
      return window;
    },
    PixelMath: function () {
      context.process = this;
      this.executeOn = view => {
        if (context.failure === 'throw') throw Error('allocation failed');
        if (context.failure === 'false') return false;
        const ids = windows.slice(0, 3).map(w => w.mainView.id);
        view.image.samples = ['expression', 'expression1', 'expression2'].map(key =>
          Function(...ids, 'return ' + this[key])(...context.samples));
        return true;
      };
    }
  };
  context.ImageWindow.windows = windows;
  context.samples = [0.2, 0.7, 0.9];
  vm.createContext(context);
  const script = fs.readFileSync(path.join(__dirname, '../src/scripts/Toolbox/SHOToRGBStars.js'), 'utf8')
    .replace(/^#.*$/gm, '').replace(/main\(\);\s*$/, '');
  vm.runInContext(script, context);
  for (const id of ['Hydrogen_master', 'OIII_stars', 'Sulphur_2'])
    new context.ImageWindow(32, 24, 1, 32, true, false, id);
  context.ids = windows.map(w => w.mainView.id);
  return context;
}

test('channel formula, distinct RGB destination, untouched sources and unclipped sums', () => {
  const c = runtime();
  const before = JSON.stringify(c.ImageWindow.windows);
  c.samples = [-0.2, 1.7, 0.9];
  const out = c.createRGBStars(c.ids, 'RGB_result');
  const values = out.mainView.image.samples;
  for (const [i, expected] of [0.46, 0.89, 1.7].entries())
    assert.ok(Math.abs(values[i] - expected) < 1e-12);
  assert.equal(out.mainView.image.isColor, true);
  assert.equal(out.shown, true);
  assert.equal(c.process.rescale, false);
  assert.equal(c.process.truncate, false);
  assert.equal(c.process.createNewImage, false);
  assert.equal(JSON.stringify(c.ImageWindow.windows.slice(0, 3)), before);
});

test('rejects missing, repeated, closed, color, alpha, complex and mismatched sources', () => {
  const c = runtime();
  assert.throws(() => c.validateSources(['', '', ''], 'out'), /Select/);
  assert.throws(() => c.validateSources([c.ids[0], c.ids[0], c.ids[2]], 'out'), /distinct/);
  assert.throws(() => c.validateSources(['gone', c.ids[1], c.ids[2]], 'out'), /no longer open/);
  const image = c.ImageWindow.windows[1].mainView.image;
  for (const [key, value] of [['isColor', true], ['numberOfChannels', 2], ['isComplex', true], ['width', 64], ['height', 48]]) {
    const original = image[key];
    image[key] = value;
    assert.throws(() => c.validateSources(c.ids, 'out'));
    image[key] = original;
  }
  assert.equal(c.ImageWindow.windows.length, 3);
});

test('validates output IDs, never overwrites, and proposes an unused ID', () => {
  const c = runtime();
  for (const id of ['', '2bad', 'bad id', 'bad;id', c.ids[0]])
    assert.throws(() => c.createRGBStars(c.ids, id));
  c.createRGBStars(c.ids, 'SHO_RGB_Stars');
  assert.equal(c.nextOutputId(), 'SHO_RGB_Stars_1');
  assert.throws(() => c.createRGBStars(c.ids, 'SHO_RGB_Stars'), /already in use/);
  assert.equal(c.ImageWindow.windows.length, 4);
});

test('failed or cancelled PixelMath removes only its partial output', () => {
  for (const failure of ['false', 'throw']) {
    const c = runtime();
    c.failure = failure;
    assert.throws(() => c.createRGBStars(c.ids, 'out'));
    assert.equal(c.ImageWindow.windows.length, 3);
  }
});


test('GUI creates RGB from selected starless images without a confirmation step', () => {
  const c = runtime();
  c.Sizer.prototype.add = c.Sizer.prototype.addStretch = function () {};
  c.Dialog.prototype.setFixedWidth = c.Dialog.prototype.adjustToContents = function () {};
  c.Dialog.prototype.ok = function () { this.completed = true; };
  const labels = [];
  for (const name of ['Label', 'Edit', 'PushButton'])
    c[name] = function () {
      this.setFixedWidth = function () {};
      if (name === 'Label') labels.push(this);
    };
  c.ComboBox = function () {
    this.items = [];
    this.addItem = text => this.items.push(text);
    this.itemText = index => this.items[index];
  };
  c.Console = { writeln() {} };
  c.MessageBox = function (message) { throw Error(message); };
  const dialog = new c.SHOToRGBStarsDialog();
  assert.deepEqual(labels.slice(1, 4).map(label => label.text), ['SII:', 'Ha:', 'OIII:']);
  dialog.selectors.forEach((selector, i) => { selector.currentItem = i + 1; });
  dialog.createButton.onClick();
  assert.equal(dialog.completed, true);
  const rgb = c.ImageWindow.windows[3].mainView.image.samples;
  for (const [i, expected] of [0.62, 0.61, 0.7].entries())
    assert.ok(Math.abs(rgb[i] - expected) < 1e-12);
  assert.equal(c.ImageWindow.windows.length, 4);
});
