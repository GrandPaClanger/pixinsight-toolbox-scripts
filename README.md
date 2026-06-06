# Chapel Astro Utilities for PixInsight

PixInsight JavaScript Runtime scripts published through the Chapel Astro
Utilities update repository.

PixInsight repository URL:

`https://raw.githubusercontent.com/GrandPaClanger/pixinsight-toolbox-scripts/main/`

Add it in PixInsight:

`Resources > Updates > Manage Repositories`

Then run:

`Resources > Updates > Check for Updates`

## Menu Location

After installation, scripts appear under:

`Script > Chapel Astro Utilities`

Older installs of `MatchOpenImageSizes` that previously appeared under
`Script > Toolbox` are updated by the new package. The script file path remains
compatible, so it should appear once under the new `Chapel Astro Utilities`
menu after PixInsight refreshes scripts.

## Scripts

### ImageRenameByFilter

Menu:

`Script > Chapel Astro Utilities > ImageRenameByFilter`

Version:

`1.0.2`

Purpose:

Renames open image windows and optionally saves images using either filter
mapping rules or a suffix applied to current image identifiers.

#### Rename By Filter Mappings

Use this mode for newly stacked master frames with long generated names.

The mapping table uses:

- `Text to find`: text searched in the current view id, file path, or caption.
- `Rename to`: the PixInsight-safe identifier to use.

Default mappings:

```csv
Luminance,L
Red,R
Green,G
Blue,B
Sulphur,S
Hydrogen,H
Oxygen,O
```

More specific mappings win. For example, a mapping from `Red_Prestretch` to
`Red_PostStretch` is chosen before a generic `Red` mapping.

#### Append Suffix To Current Names

Use this mode after processing existing renamed images.

Example:

- Current image: `R`
- Suffix: `PreStretch`
- New image: `R_PreStretch`

Suffix values are sanitized for PixInsight identifiers. Invalid characters are
converted to underscores.

#### Preview Selection

The preview lists all open image windows. Checked rows are included in the
operation. Use `Select All` and `Unselect All` to change the batch quickly.

Collapsed/iconized windows are unchecked by default when PixInsight exposes
that state.

#### Save Images After Renaming

When enabled, the script saves renamed images.

The output folder defaults to the source image folder when PixInsight exposes
the path. You can browse to another folder.

Post-save actions:

- Leave selected images open
- Collapse selected images
- Close selected images

`Open newly saved images` appears only when saving is enabled.

In suffix mode, saving creates suffixed copies while preserving the original
open images.

#### Save && Overwrite

`Save && Overwrite` is a separate action next to `Apply`.

It saves the checked open images back to their current file paths after one
confirmation. It is intended for in-place overwrite saves, not Save As output.

### MatchOpenImageSizes

Menu:

`Script > Chapel Astro Utilities > MatchOpenImageSizes`

Version:

`1.0.2`

Purpose:

Matches all other open image windows to a selected reference image window. The
reference window is not changed. The script copies the reference zoom and
attempts to copy the window frame size where PixInsight exposes writable
image-window geometry. Images with different pixel dimensions are resampled to
the reference dimensions.

It also supports PixInsight process icons:

1. Run `Script > Chapel Astro Utilities > MatchOpenImageSizes`.
2. Use the New Instance triangle to drag a process icon to the PixInsight
   workspace.
3. Drag that process icon onto an image window to use it as the reference.

Create the desktop process icon first, then drag that icon onto an image.

## Repository Layout

PixInsight scans scripts under:

`src/scripts/`

Installed scripts:

`src/scripts/Toolbox/ImageRenameByFilter.js`

`src/scripts/Toolbox/MatchOpenImageSizes.js`

The update package is:

`packages/ChapelAstroUtilities-1.0.2.zip`

## Change Log

### Chapel Astro Utilities 1.0.2

- Updated `ImageRenameByFilter` to 1.0.2.
- Simplified the reopened-window fit-to-zoom implementation to avoid a
  PixInsight strict parser error seen in 1.0.1.

### Chapel Astro Utilities 1.0.1

- Updated `ImageRenameByFilter` to 1.0.1.
- Reopened saved images now keep the saved zoom and resize their windows to the
  zoomed image footprint to reduce large gray margins.

### Chapel Astro Utilities 1.0.0

- Added `ImageRenameByFilter` 1.0.0.
- Updated `MatchOpenImageSizes` to 1.0.2.
- Moved scripts to `Script > Chapel Astro Utilities`.
