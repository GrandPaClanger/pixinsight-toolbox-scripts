# PixInsight Toolbox Scripts

Repository for PixInsight JavaScript Runtime scripts.

PixInsight repository URL:

`https://raw.githubusercontent.com/GrandPaClanger/pixinsight-toolbox-scripts/main/`

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

Do not drag the live New Instance triangle directly onto an image. Current PixInsight versions report this as recursive script-instance execution. Create the desktop process icon first, then drag that icon onto an image.

## PixInsight Repository URL

Members should add this URL in PixInsight:

`https://raw.githubusercontent.com/GrandPaClanger/pixinsight-toolbox-scripts/main/`

PixInsight path:

`Resources > Updates > Manage Repositories`

Then use:

`Resources > Updates > Check for Updates`

PixInsight retrieves repository information from:

`updates.xri`

## Repository Layout

PixInsight scans scripts under:

`src/scripts/`

This script is installed from:

`src/scripts/Toolbox/MatchOpenImageSizes.js`

The update package is:

`packages/MatchOpenImageSizes-1.0.1.zip`
