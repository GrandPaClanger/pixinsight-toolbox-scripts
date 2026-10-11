# StarRecombine

Installed menu: **Script > Chapel Astro Utilities > StarRecombine**.

You can also run `src/scripts/Toolbox/StarRecombine.js` with PixInsight's
**Script > Execute Script File**. Open your starless and stars-only images first.

1. Select the starless image and the matching stars-only image.
2. Click **Preview**.
3. Adjust **Star intensity**. The preview updates when you release the slider,
   or change the percentage box. The Preview button also refreshes it after
   keyboard slider changes.
4. Enable **100% view** and drag the preview to inspect stars at their actual
   pixel size, or leave it unchecked to see the whole image.
5. Click **Create Recombined**.

The script reads both originals and creates a new 32-bit floating-point image.
It does not save a file automatically. If `Recombined` already exists, the new
image is named `Recombined_1`, `Recombined_2`, etc.

Use aligned images with identical dimensions and colour channels. This screen
blend is intended for images that have already been stretched. The preview
shows actual pixel values without an STF display stretch.

At 100%, for source values in the normal 0–1 range, the calculation equals:

```text
~((~starless)*(~stars))
```

At other settings the stars are multiplied by the selected intensity before
blending. 0% produces the starless image, 50% reduces the star contribution,
and 200% doubles the stars before blending. Boosted star values are clipped
to 0–1, and output is clipped rather than rescaled. This changes brightness,
not star diameter.

The preview uses the full-resolution PixelMath calculation, then fits its
display into the dialog. Large images can take a moment and require memory
for one temporary result plus its display bitmap. The temporary image is
closed after each update and also on preview errors.

Validation: JavaScript syntax and mocked process checks can be run outside
PixInsight. The dialog and native process execution still require a check
inside PixInsight.
