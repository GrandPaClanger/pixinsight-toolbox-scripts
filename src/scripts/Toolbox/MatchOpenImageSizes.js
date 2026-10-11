// MatchOpenImageSizes.js
//
// PixInsight JavaScript Runtime script.
//
// Copyright (c) 2026 Ian Steane. All rights reserved.
// Public visibility is for PixInsight update distribution only. No permission
// is granted to copy, modify, redistribute, repackage, sell, sublicense, or
// create derivative works without prior written permission.
//
// Match all open image windows to a reference image window's zoom and, where
// PixInsight exposes writable geometry, frame size. When invoked as a view
// target from a process icon, the dropped-on view is used as the reference.

#feature-id    MatchOpenImageSizes : Chapel Astro Utilities > MatchOpenImageSizes
#feature-info  Match open image window display size to a selected reference window.

var TITLE = "MatchOpenImageSizes";
var VERSION = "1.2.1";

var FrameStyle_Box = 1;
var ResizeMode_AbsolutePixels = 1;
var AbsoluteResizeMode_ForceWidthAndHeight = 0;
var StdButton_Ok = 1;
var StdButton_Yes = 3;
var StdButton_No = 4;
var StdIcon_Question = 1;
var StdIcon_Information = 2;
var StdIcon_Error = 4;
var TextAlign_Right = 0x02;
var TextAlign_VertCenter = 0x80;
var UndoFlag_DefaultMode = 0x00000000;

function HorizontalSizer()
{
   this.__base__ = Sizer;
   this.__base__( false );
}
HorizontalSizer.prototype = new Sizer;

function VerticalSizer()
{
   this.__base__ = Sizer;
   this.__base__( true );
}
VerticalSizer.prototype = new Sizer;

function formatSize( image )
{
   return image.width.toString() + " x " + image.height.toString();
}

function zoomText( zoom )
{
   if ( zoom > 0 )
      return zoom.toString() + ":1";
   if ( zoom < 0 )
      return "1:" + (-zoom).toString();
   return "current";
}

function captureGeometry( window )
{
   var hasFrameRect = typeof window.frameRect != "undefined";
   var frameWidth = 0;
   var frameHeight = 0;

   try
   {
      if ( hasFrameRect )
      {
         frameWidth = window.frameRect.width;
         frameHeight = window.frameRect.height;
      }
   }
   catch ( error )
   {
      hasFrameRect = false;
   }

   return {
      hasSize: typeof window.width == "number" && typeof window.height == "number",
      width: typeof window.width == "number" ? window.width : 0,
      height: typeof window.height == "number" ? window.height : 0,
      hasFrameRect: hasFrameRect,
      frameWidth: frameWidth,
      frameHeight: frameHeight,
      zoom: window.zoomFactor
   };
}

function resizeImageToReference( targetWindow, referenceWidth, referenceHeight )
{
   var view = targetWindow.mainView;

   view.beginProcess( UndoFlag_DefaultMode );
   view.image.resample( referenceWidth,
                        referenceHeight,
                        ResizeMode_AbsolutePixels,
                        AbsoluteResizeMode_ForceWidthAndHeight );
   view.endProcess();
}

function setZoom( targetWindow, zoom )
{
   targetWindow.zoomFactor = zoom;
}

function copyReferenceFrame( targetWindow, referenceGeometry )
{
   try
   {
      if ( referenceGeometry.hasSize &&
           typeof targetWindow.resize == "function" )
      {
         targetWindow.resize( referenceGeometry.width, referenceGeometry.height );
         return "resize()";
      }
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( referenceGeometry.hasSize &&
           typeof targetWindow.width == "number" &&
           typeof targetWindow.height == "number" )
      {
         targetWindow.width = referenceGeometry.width;
         targetWindow.height = referenceGeometry.height;
         return "width/height";
      }
   }
   catch ( error2 )
   {
   }

   try
   {
      if ( referenceGeometry.hasFrameRect &&
           typeof targetWindow.frameRect != "undefined" &&
           typeof targetWindow.position != "undefined" )
      {
         var p = targetWindow.position;
         targetWindow.frameRect = new Rect( p.x,
                                            p.y,
                                            p.x + referenceGeometry.frameWidth,
                                            p.y + referenceGeometry.frameHeight );
         return "frameRect";
      }
   }
   catch ( error3 )
   {
   }

   return "";
}

function channelGroup( window )
{
   var id = window.mainView.id.toUpperCase();
   var tokens = id.replace( /[^A-Z0-9]+/g, "_" ).split( "_" );

   for ( var i = 0; i < tokens.length; ++i )
   {
      var token = tokens[i];

      if ( token == "S" || token == "SII" || token == "SULPHUR" || token == "SULFUR" )
         return { name: "SHO", order: 0 };
      if ( token == "H" || token == "HA" || token == "HALPHA" || token == "HYDROGEN" )
         return { name: "SHO", order: 1 };
      if ( token == "O" || token == "OIII" || token == "OXYGEN" )
         return { name: "SHO", order: 2 };
      if ( token == "SHO" )
         return { name: "SHO", order: 3 };

      if ( token == "L" || token == "LUMINANCE" )
         return { name: "LRGB", order: 0 };
      if ( token == "R" || token == "RED" )
         return { name: "LRGB", order: 1 };
      if ( token == "G" || token == "GREEN" )
         return { name: "LRGB", order: 2 };
      if ( token == "B" || token == "BLUE" )
         return { name: "LRGB", order: 3 };
      if ( token == "LRGB" || token == "RGB" )
         return { name: "LRGB", order: 4 };
   }

   return { name: "Other", order: 0 };
}

function placeWindowInTile( window, tileRect )
{
   window.geometry = tileRect;
   var viewportRect = window.visibleViewportRect;
   var viewportWidth = Math.max( 1, viewportRect.width );
   var viewportHeight = Math.max( 1, viewportRect.height );
   var image = window.mainView.image;
   var divisor = Math.max( image.width/viewportWidth,
                           image.height/viewportHeight );

   window.zoomFactor = divisor <= 1 ? 1 : -Math.ceil( divisor );
   window.geometry = tileRect;
}

function bestMonitorGrid( itemCount, screenRect, frameAspect )
{
   var margin = 12;
   var gap = 10;
   var reservedHeight = 120;
   var availableWidth = Math.max( 1, screenRect.width - 2*margin );
   var availableHeight = Math.max( 1, screenRect.height - reservedHeight - 2*margin );
   var best = null;

   for ( var columns = 1; columns <= itemCount; ++columns )
   {
      var rows = Math.ceil( itemCount/columns );
      var rawWidth = Math.floor( (availableWidth - (columns - 1)*gap)/columns );
      var rawHeight = Math.floor( (availableHeight - (rows - 1)*gap)/rows );
      var width = rawWidth;
      var height = rawHeight;

      if ( width/height > frameAspect )
         width = Math.floor( height*frameAspect );
      else
         height = Math.floor( width/frameAspect );

      var area = width*height;
      if ( best == null || area > best.area )
         best = {
            columns: columns,
            rows: rows,
            width: width,
            height: height,
            area: area
         };
   }

   return best;
}

function arrangeGroupsAcrossMonitors( groups, screenRects, frameAspect )
{
   while ( groups.length > screenRects.length )
   {
      var extra = groups.pop();
      var destination = groups[groups.length - 1];
      destination.name += "+" + extra.name;
      destination.items = destination.items.concat( extra.items );
   }

   if ( groups.length == 1 && screenRects.length > 1 )
   {
      var source = groups[0];
      var splitGroups = new Array;
      var offset = 0;

      for ( var s = 0; s < screenRects.length && offset < source.items.length; ++s )
      {
         var remainingItems = source.items.length - offset;
         var remainingScreens = screenRects.length - s;
         var count = Math.ceil( remainingItems/remainingScreens );
         splitGroups.push( {
            name: source.name,
            items: source.items.slice( offset, offset + count )
         } );
         offset += count;
      }

      groups = splitGroups;
   }

   var layouts = new Array;
   var cellWidth = 0;
   var cellHeight = 0;

   for ( var i = 0; i < groups.length; ++i )
   {
      var layout = bestMonitorGrid( groups[i].items.length,
                                    screenRects[i], frameAspect );
      layouts.push( layout );
      cellWidth = cellWidth == 0 ? layout.width : Math.min( cellWidth, layout.width );
      cellHeight = cellHeight == 0 ? layout.height : Math.min( cellHeight, layout.height );
   }

   if ( cellWidth < 160 || cellHeight < 120 )
      throw new Error( "The multi-monitor desktop is too small to arrange the image windows." );

   var margin = 12;
   var gap = 10;
   var reservedHeight = 120;

   for ( var g = 0; g < groups.length; ++g )
   {
      var items = groups[g].items;
      var screen = screenRects[g];
      var columns = layouts[g].columns;
      var rowCount = Math.ceil( items.length/columns );
      var availableHeight = Math.max( 1, screen.height - reservedHeight - 2*margin );
      var blockHeight = rowCount*cellHeight + (rowCount - 1)*gap;
      var startY = screen.y0 + margin + Math.floor( (availableHeight - blockHeight)/2 );

      for ( var row = 0; row < rowCount; ++row )
      {
         var first = row*columns;
         var count = Math.min( columns, items.length - first );
         var rowWidth = count*cellWidth + (count - 1)*gap;
         var startX = screen.x0 + margin +
            Math.floor( (screen.width - 2*margin - rowWidth)/2 );

         for ( var col = 0; col < count; ++col )
         {
            var x = startX + col*(cellWidth + gap);
            var y = startY + row*(cellHeight + gap);
            placeWindowInTile( items[first + col].window,
                               new Rect( x, y, x + cellWidth, y + cellHeight ) );
         }
      }

      Console.writeln( "Arranged " + groups[g].name + " group on monitor " +
                       (g + 1).toString() + ": " +
                       items.length.toString() + " window(s)." );
   }
}

function arrangeMatchedWindows( windows, screenRects, frameAspect )
{
   if ( windows.length == 0 )
      return;

   var groups = { SHO: new Array, LRGB: new Array, Other: new Array };

   for ( var i = 0; i < windows.length; ++i )
   {
      var classification = channelGroup( windows[i] );
      groups[classification.name].push( {
         window: windows[i],
         order: classification.order
      } );
   }

   var rows = new Array;
   var groupNames = ["SHO", "LRGB", "Other"];

   for ( var g = 0; g < groupNames.length; ++g )
   {
      var group = groups[groupNames[g]];
      if ( group.length == 0 )
         continue;

      group.sort( function( a, b )
      {
         if ( a.order != b.order )
            return a.order - b.order;
         var aId = a.window.mainView.id.toUpperCase();
         var bId = b.window.mainView.id.toUpperCase();
         return aId < bId ? -1 : (aId > bId ? 1 : 0);
      } );
      rows.push( { name: groupNames[g], items: group } );
   }

   if ( screenRects.length > 1 )
   {
      arrangeGroupsAcrossMonitors( rows, screenRects, frameAspect );
      return;
   }

   var screenRect = screenRects[0];
   var columns = 1;
   for ( var r = 0; r < rows.length; ++r )
      columns = Math.max( columns, rows[r].items.length );

   var margin = 12;
   var gap = 10;
   var reservedHeight = 120;
   var availableWidth = Math.max( 1, screenRect.width - 2*margin );
   var availableHeight = Math.max( 1, screenRect.height - reservedHeight - 2*margin );
   var cellWidth = Math.floor( (availableWidth - (columns - 1)*gap)/columns );
   var cellHeight = Math.floor( (availableHeight - (rows.length - 1)*gap)/rows.length );

   if ( cellWidth < 160 || cellHeight < 120 )
      throw new Error( "The available workspace is too small to arrange " +
                       windows.length.toString() + " image windows." );

   for ( var row = 0; row < rows.length; ++row )
   {
      var items = rows[row].items;
      var rowWidth = items.length*cellWidth + (items.length - 1)*gap;
      var startX = margin + Math.floor( (availableWidth - rowWidth)/2 );
      var y = margin + row*(cellHeight + gap);

      for ( var col = 0; col < items.length; ++col )
      {
         var x = startX + col*(cellWidth + gap);
         var window = items[col].window;
         var tileRect = new Rect( x, y, x + cellWidth, y + cellHeight );
         placeWindowInTile( window, tileRect );
      }

      Console.writeln( "Arranged " + rows[row].name + " group: " +
                       items.length.toString() + " window(s)." );
   }
}

function currentAvailableScreenRect()
{
   var probe = new Dialog;
   return new Rect( probe.availableScreenRect );
}

function windowsMonitorRects()
{
   if ( CoreApplication.platform != "Windows" )
      throw new Error( "Automatic multi-monitor detection is currently available on Windows only." );

   var command =
      "Add-Type -AssemblyName System.Windows.Forms; " +
      "[System.Windows.Forms.Screen]::AllScreens | ForEach-Object { " +
      "$r=$_.WorkingArea; Write-Output " +
      "($r.Left.ToString()+','+$r.Top.ToString()+','+" +
      "$r.Width.ToString()+','+$r.Height.ToString()) }";
   var process = new ExternalProcess( "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command] );

   if ( !process.waitForFinished() )
      throw new Error( "Timed out while detecting monitors." );

   var output = process.stdout.utf8ToString().trim();
   if ( process.exitCode != 0 || output.length == 0 )
      throw new Error( "Windows did not return monitor geometry." );

   var rects = new Array;
   var lines = output.split( /\r?\n/ );

   for ( var i = 0; i < lines.length; ++i )
   {
      var fields = lines[i].trim().split( "," );
      if ( fields.length != 4 )
         continue;

      var x = parseInt( fields[0], 10 );
      var y = parseInt( fields[1], 10 );
      var width = parseInt( fields[2], 10 );
      var height = parseInt( fields[3], 10 );

      if ( isFinite( x ) && isFinite( y ) && width > 0 && height > 0 )
         rects.push( new Rect( x, y, x + width, y + height ) );
   }

   rects.sort( function( a, b )
   {
      return a.x0 != b.x0 ? a.x0 - b.x0 : a.y0 - b.y0;
   } );

   if ( rects.length == 0 )
      throw new Error( "No usable monitor rectangles were detected." );

   return rects;
}

function layoutScreenRects( currentScreenRect, useAllMonitors )
{
   if ( !useAllMonitors )
      return [currentScreenRect];

   try
   {
      var rects = windowsMonitorRects();
      if ( rects.length > 1 )
      {
         Console.writeln( "Detected " + rects.length.toString() +
                          " monitors for window arrangement." );
         for ( var i = 0; i < rects.length; ++i )
            Console.writeln( "Monitor " + (i + 1).toString() + ": x=" +
                             rects[i].x0.toString() + ", y=" +
                             rects[i].y0.toString() + ", " +
                             rects[i].width.toString() + " x " +
                             rects[i].height.toString() + "." );
         return rects;
      }

      Console.warningln( "Only one monitor was detected; using the current screen." );
   }
   catch ( error )
   {
      Console.warningln( "Multi-monitor detection failed: " + error.message +
                         " Using the current screen." );
   }

   return [currentScreenRect];
}

function matchWindowsToReference( referenceWindow, confirm, arrangeWindows,
                                  useAllMonitors, screenRect )
{
   if ( referenceWindow.isNull )
      throw new Error( "No reference image window is available." );

   var referenceView = referenceWindow.mainView;
   var referenceImage = referenceView.image;
   var referenceWidth = referenceImage.width;
   var referenceHeight = referenceImage.height;
   var referenceGeometry = captureGeometry( referenceWindow );
   var referenceZoom = referenceGeometry.zoom;
   var windows = ImageWindow.windows;
   var targets = new Array;
   var resizeCount = 0;
   var frameCopyCount = 0;
   var matchedWindows = new Array;
   matchedWindows.push( referenceWindow );

   for ( var i = 0; i < windows.length; ++i )
      if ( windows[i].mainView.id != referenceView.id )
         targets.push( windows[i] );

   if ( targets.length == 0 )
   {
      (new MessageBox( "There are no other open image windows to match.",
                       TITLE, StdIcon_Information, StdButton_Ok )).execute();
      return;
   }

   if ( confirm )
   {
      var message =
         "Reference image: " + referenceView.id + "\n" +
         "Reference size: " + formatSize( referenceImage ) + " px\n" +
         "Reference zoom: " + zoomText( referenceZoom ) + "\n" +
         (referenceGeometry.hasSize ?
            "Reference frame: " + referenceGeometry.width.toString() + " x " +
               referenceGeometry.height.toString() + "\n\n" :
            "\n") +
         "The reference image data will not be changed.\n\n" +
         "Other open image windows will be matched to the reference zoom and frame size. " +
         "Images with different pixel dimensions will be resampled." +
         (arrangeWindows ?
            "\n\nAll matched windows, including the reference window, will then be " +
            "arranged in SHO and LRGB groups and zoomed to fit." +
            (useAllMonitors ? " The groups will be distributed across all detected monitors." : "") : "");

      if ( (new MessageBox( message, TITLE, StdIcon_Question,
                            StdButton_Yes, StdButton_No )).execute() != StdButton_Yes )
         return;
   }

   Console.show();
   Console.writeln( "<end><cbr><br>" + TITLE + " " + VERSION );
   Console.writeln( "Reference: " + referenceView.id + " (" +
                    formatSize( referenceImage ) + " px, zoom " +
                    zoomText( referenceZoom ) + ")" );

   for ( var j = 0; j < targets.length; ++j )
   {
      var targetWindow = targets[j];
      var targetView = targetWindow.mainView;
      var targetImage = targetView.image;

      if ( targetImage.width != referenceWidth || targetImage.height != referenceHeight )
      {
         Console.writeln( "Resampling " + targetView.id + " from " +
                          formatSize( targetImage ) + " px" );
         resizeImageToReference( targetWindow, referenceWidth, referenceHeight );
         ++resizeCount;
      }

      setZoom( targetWindow, referenceZoom );

      var frameMethod = copyReferenceFrame( targetWindow, referenceGeometry );
      if ( frameMethod.length > 0 )
      {
         ++frameCopyCount;
         setZoom( targetWindow, referenceZoom );
         Console.writeln( "Copied frame for " + targetView.id + " using " + frameMethod + "." );
      }
      else
      {
         Console.warningln( "Could not copy frame for " + targetView.id +
                            "; this PixInsight build did not expose writable image-window geometry." );
      }

      matchedWindows.push( targetWindow );
   }

   if ( arrangeWindows )
   {
      try
      {
         var currentScreen = screenRect != null ? screenRect : currentAvailableScreenRect();
         arrangeMatchedWindows( matchedWindows,
                                layoutScreenRects( currentScreen, useAllMonitors ),
                                referenceWidth/referenceHeight );
      }
      catch ( layoutError )
      {
         Console.warningln( "Window arrangement was skipped: " + layoutError.message );
      }
   }

   referenceWindow.bringToFront();
   Console.writeln( "Done. Resampled " + resizeCount.toString() +
                    " image window(s); copied frame for " +
                    frameCopyCount.toString() + " window(s)." );

}

function mainWindowIds()
{
   var ids = new Array;
   var windows = ImageWindow.windows;

   for ( var i = 0; i < windows.length; ++i )
      ids.push( windows[i].mainView.id );

   return ids;
}

function windowByMainViewId( id )
{
   var windows = ImageWindow.windows;

   for ( var i = 0; i < windows.length; ++i )
      if ( windows[i].mainView.id == id )
         return windows[i];

   return ImageWindow.windowById( "__MatchOpenImageSizes_NoSuchWindow__" );
}

function defaultReferenceId()
{
   if ( Parameters.isViewTarget )
      return Parameters.targetView.window.mainView.id;

   if ( Parameters.has( "referenceViewId" ) )
      return Parameters.get( "referenceViewId" );

   if ( !ImageWindow.activeWindow.isNull )
      return ImageWindow.activeWindow.mainView.id;

   return "";
}

function exportParameters( referenceViewId, arrangeWindows, useAllMonitors )
{
   Parameters.set( "version", VERSION );
   Parameters.set( "referenceViewId", referenceViewId );
   Parameters.set( "arrangeWindows", arrangeWindows );
   Parameters.set( "useAllMonitors", useAllMonitors );
}

function parameterArrangeWindows()
{
   return Parameters.has( "arrangeWindows" ) && Parameters.getBoolean( "arrangeWindows" );
}

function parameterUseAllMonitors()
{
   return Parameters.has( "useAllMonitors" ) && Parameters.getBoolean( "useAllMonitors" );
}

function MatchOpenImageSizesDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   var dialog = this;
   var ids = mainWindowIds();
   var currentId = defaultReferenceId();

   this.windowTitle = TITLE + " " + VERSION;

   this.infoLabel = new Label( this );
   this.infoLabel.text =
      "Select the reference image window. Other open image windows will be matched to it.";
   this.infoLabel.wordWrapping = true;
   this.infoLabel.frameStyle = FrameStyle_Box;
   this.infoLabel.margin = 6;

   this.referenceLabel = new Label( this );
   this.referenceLabel.text = "Reference:";
   this.referenceLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.referenceCombo = new ComboBox( this );
   for ( var i = 0; i < ids.length; ++i )
   {
      this.referenceCombo.addItem( ids[i] );
      if ( ids[i] == currentId )
         this.referenceCombo.currentItem = i;
   }

   this.referenceSizer = new HorizontalSizer;
   this.referenceSizer.spacing = 6;
   this.referenceSizer.add( this.referenceLabel );
   this.referenceSizer.add( this.referenceCombo, 100 );

   this.arrangeCheckBox = new CheckBox( this );
   this.arrangeCheckBox.text = "Arrange matched images";
   this.arrangeCheckBox.checked = parameterArrangeWindows();
   this.arrangeCheckBox.toolTip =
      "Arrange matched image windows in compact SHO and LRGB groups using the available screen space, then zoom each image to fit.";
   this.arrangeCheckBox.onCheck = function( checked )
   {
      dialog.allMonitorsCheckBox.enabled = checked;
   };

   this.allMonitorsCheckBox = new CheckBox( this );
   this.allMonitorsCheckBox.text = "Use all monitors";
   this.allMonitorsCheckBox.checked = parameterUseAllMonitors();
   this.allMonitorsCheckBox.enabled = this.arrangeCheckBox.checked;
   this.allMonitorsCheckBox.toolTip =
      "Detect all Windows monitors and arrange filter groups on separate screens. If detection fails, the current screen is used.";

   this.newInstanceButton = new ToolButton( this );
   this.newInstanceButton.icon = this.scaledResource( ":/process-interface/new-instance.png" );
   this.newInstanceButton.setScaledFixedSize( 24, 24 );
   this.newInstanceButton.toolTip =
      "New Instance: drag to the workspace first to create a process icon. Then drag that process icon to an image to use it as the reference.";
   this.newInstanceButton.onMousePress = function()
   {
      exportParameters( dialog.referenceCombo.itemText( dialog.referenceCombo.currentItem ),
                        dialog.arrangeCheckBox.checked,
                        dialog.allMonitorsCheckBox.checked );
      dialog.newInstance();
   };

   this.executeButton = new PushButton( this );
   this.executeButton.text = "Apply";
   this.executeButton.icon = this.scaledResource( ":/icons/execute.png" );
   this.executeButton.defaultButton = true;
   this.executeButton.onClick = function()
   {
      var id = dialog.referenceCombo.itemText( dialog.referenceCombo.currentItem );
      var arrangeWindows = dialog.arrangeCheckBox.checked;
      var useAllMonitors = dialog.allMonitorsCheckBox.checked;
      var screenRect = new Rect( dialog.availableScreenRect );
      exportParameters( id, arrangeWindows, useAllMonitors );
      var referenceWindow = windowByMainViewId( id );
      dialog.ok();
      matchWindowsToReference( referenceWindow, true, arrangeWindows,
                               useAllMonitors, screenRect );
   };

   this.cancelButton = new PushButton( this );
   this.cancelButton.text = "Close";
   this.cancelButton.icon = this.scaledResource( ":/icons/close.png" );
   this.cancelButton.onClick = function()
   {
      dialog.cancel();
   };

   this.buttonSizer = new HorizontalSizer;
   this.buttonSizer.spacing = 6;
   this.buttonSizer.add( this.newInstanceButton );
   this.buttonSizer.addStretch();
   this.buttonSizer.add( this.executeButton );
   this.buttonSizer.add( this.cancelButton );

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 8;
   this.sizer.add( this.infoLabel );
   this.sizer.add( this.referenceSizer );
   this.sizer.add( this.arrangeCheckBox );
   this.sizer.add( this.allMonitorsCheckBox );
   this.sizer.add( this.buttonSizer );

   this.adjustToContents();
   this.setFixedWidth( 520 );
}

MatchOpenImageSizesDialog.prototype = new Dialog;

function main()
{
   if ( ImageWindow.windows.length == 0 )
   {
      (new MessageBox( "Open at least two image windows before running this script.",
                       TITLE, StdIcon_Error, StdButton_Ok )).execute();
      return;
   }

   if ( Parameters.isViewTarget )
   {
      matchWindowsToReference( Parameters.targetView.window, true,
                               parameterArrangeWindows(), parameterUseAllMonitors(), null );
      return;
   }

   if ( Parameters.isGlobalTarget && Parameters.has( "referenceViewId" ) )
   {
      var window = windowByMainViewId( Parameters.get( "referenceViewId" ) );
      if ( !window.isNull )
      {
         matchWindowsToReference( window, true, parameterArrangeWindows(),
                                  parameterUseAllMonitors(), null );
         return;
      }
   }

   var dialog = new MatchOpenImageSizesDialog;
   dialog.execute();
}

main();
