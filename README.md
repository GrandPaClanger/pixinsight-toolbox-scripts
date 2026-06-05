# PixInsight Toolbox Scripts

Repository for PixInsight JavaScript Runtime scripts.

## Included Scripts

### MatchOpenImageSizes

Menu location:

`Script > Toolbox > MatchOpenImageSizes`

Purpose:

Matches all other open image windows to a selected reference image window. The reference window is not changed. The script copies the reference zoom and attempts to copy the window frame size where PixInsight exposes writable image-window geometry.

It also supports PixInsight process icons:

1. Run `Script > Toolbox > MatchOpenImageSizes`.
2. Use the New Instance triangle to drag a process icon to the PixInsight workspace.
3. Drag that process icon onto an image window to use that image as the reference.

## PixInsight Repository URL

After this repository is published to GitHub as:

`https://github.com/GrandPaClanger/pixinsight-toolbox-scripts`

members should add this URL in PixInsight:

`https://raw.githubusercontent.com/GrandPaClanger/pixinsight-toolbox-scripts/main/`

PixInsight path:

`Resources > Updates > Manage Repositories`

Then use:

`Resources > Updates > Check for Updates`

## Repository Layout

PixInsight scans scripts under:

`src/scripts/`

This script is installed from:

`src/scripts/Toolbox/MatchOpenImageSizes.js`

