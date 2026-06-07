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
var VERSION = "1.0.4";

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

function matchWindowsToReference( referenceWindow, confirm )
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
         "The reference window will not be changed.\n\n" +
         "Other open image windows will be matched to the reference zoom and frame size. " +
         "Images with different pixel dimensions will be resampled.";

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

function exportParameters( referenceViewId )
{
   Parameters.set( "version", VERSION );
   Parameters.set( "referenceViewId", referenceViewId );
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

   this.newInstanceButton = new ToolButton( this );
   this.newInstanceButton.icon = this.scaledResource( ":/process-interface/new-instance.png" );
   this.newInstanceButton.setScaledFixedSize( 24, 24 );
   this.newInstanceButton.toolTip =
      "New Instance: drag to the workspace first to create a process icon. Then drag that process icon to an image to use it as the reference.";
   this.newInstanceButton.onMousePress = function()
   {
      exportParameters( dialog.referenceCombo.itemText( dialog.referenceCombo.currentItem ) );
      dialog.newInstance();
   };

   this.executeButton = new PushButton( this );
   this.executeButton.text = "Apply";
   this.executeButton.icon = this.scaledResource( ":/icons/execute.png" );
   this.executeButton.defaultButton = true;
   this.executeButton.onClick = function()
   {
      var id = dialog.referenceCombo.itemText( dialog.referenceCombo.currentItem );
      exportParameters( id );
      var referenceWindow = windowByMainViewId( id );
      dialog.ok();
      matchWindowsToReference( referenceWindow, true );
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
      matchWindowsToReference( Parameters.targetView.window, true );
      return;
   }

   if ( Parameters.isGlobalTarget && Parameters.has( "referenceViewId" ) )
   {
      var window = windowByMainViewId( Parameters.get( "referenceViewId" ) );
      if ( !window.isNull )
      {
         matchWindowsToReference( window, true );
         return;
      }
   }

   var dialog = new MatchOpenImageSizesDialog;
   dialog.execute();
}

main();
