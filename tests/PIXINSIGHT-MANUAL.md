# SHO to RGB Stars runtime acceptance

Automated tests use PJSR doubles; run these checks in a supported PixInsight
installation when checking this release.

1. Execute `src/scripts/Toolbox/SHOToRGBStars.js`. With fewer than three images,
   check the clear startup error. With three images, check that all labels,
   selectors and buttons fit at your display scale. Check the selector order is SII, Ha, OIII.
2. Create three same-size monochrome constant images: Ha=0.2, OIII=0.7,
   SII=0.9. Select them in the respective fields.
   Create the output; inspect samples: R=0.62, G=0.61, B=0.7 (within source
   sample precision). Check RGB, 64-bit real format and unchanged sources.
3. Repeat with nonconstant images and inspect several corresponding pixels.
   Check that STF on sources does not affect results. Verify no rescaling or
   clipping with floating-point inputs that contain negative or >1 samples.
4. Check unselected inputs, repeated sources, RGB inputs, alpha channels,
   mismatched dimensions/drizzle scale, invalid output IDs and existing IDs.
   Each should give a clear error without creating an output or closing sources.
   Previews must not be listed. No alignment or star-content confirmation should be required.
5. Run again with the default output already open. Check the suggested suffix.
   Close/reopen the utility after opening additional source windows.
6. Test an already aligned starless SHO set and verify a starless RGB result.
   Also test stars-only sources. No star-content check should block either set.
7. If practical, cancel PixelMath during a large combination. Check that its
   partial output closes and the sources remain available.
8. In a test installation, install the ZIP referenced by `updates.xri`, refresh
   scripts/restart as required, and verify all five Chapel Astro Utilities menu
   entries, including `SHO to RGB Stars`.

For a package rebuild, ZIP all files beneath `src/scripts/` with repository-
relative paths (as in existing packages). Update the package filename, release
date and SHA-1 in `updates.xri` and the current-package reference in README.
