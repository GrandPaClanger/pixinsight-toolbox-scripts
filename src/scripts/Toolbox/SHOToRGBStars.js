// Copyright (c) 2026 Ian Steane. All rights reserved.
// PixInsight JavaScript Runtime script. Distributed with Chapel Astro Utilities.

#feature-id    SHOToRGBStars : Chapel Astro Utilities > SHO to RGB Stars
#feature-info  Combine aligned monochrome Ha, OIII and SII views into a new synthetic RGB image.

var TITLE = "SHO to RGB Stars";
var VERSION = "1.0.0";

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

function sourceView( id )
{
   var windows = ImageWindow.windows;
   for ( var i = 0; i < windows.length; ++i )
      if ( windows[i].mainView.id == id )
         return windows[i].mainView;
   throw new Error( "Source image '" + id + "' is no longer open. Reopen the utility and select it again." );
}

function validateSources( ids, outputId )
{
   if ( !/^[A-Za-z_][A-Za-z0-9_]*$/.test( outputId ) )
      throw new Error( "Output ID must start with a letter or underscore and contain only letters, digits and underscores." );
   if ( !View.viewById( outputId ).isNull )
      throw new Error( "Output ID '" + outputId + "' is already in use. Choose a different ID." );
   if ( ids.length != 3 || !ids[0] || !ids[1] || !ids[2] )
      throw new Error( "Select an image for each of Ha, OIII and SII." );
   if ( ids[0] == ids[1] || ids[0] == ids[2] || ids[1] == ids[2] )
      throw new Error( "Ha, OIII and SII must be three distinct source images." );
   var views = [];
   for ( var i = 0; i < ids.length; ++i )
   {
      // Only main views are accepted: equal-sized previews can cover different regions.
      var view = sourceView( ids[i] );
      var image = view.image;
      if ( image.isColor || image.numberOfChannels != 1 || image.isComplex )
         throw new Error( "Source '" + ids[i] + "' must be a real, single-channel monochrome image without alpha channels." );
      if ( image.width <= 0 || image.height <= 0 )
         throw new Error( "Source '" + ids[i] + "' has no image pixels." );
      if ( i > 0 && ( image.width != views[0].image.width || image.height != views[0].image.height ) )
         throw new Error( "Source dimensions differ. Register and crop all three images to the same pixel geometry first (including drizzle scale)." );
      views.push( view );
   }
   return views;
}

function nextOutputId()
{
   var base = "SHO_RGB_Stars";
   var id = base;
   for ( var n = 1; !View.viewById( id ).isNull; ++n )
      id = base + "_" + n;
   return id;
}

function createRGBStars( ids, outputId )
{
   var views = validateSources( ids, outputId );
   var output = null;
   try
   {
      // Own the destination window so every failure can discard only our output.
      // 64-bit real RGB preserves the weighted sums, including values outside [0,1].
      output = new ImageWindow( views[0].image.width, views[0].image.height,
                                3, 64, true, true, outputId );
      if ( output.isNull )
         throw new Error( "Could not allocate the RGB output image." );
      var process = new PixelMath;
      process.useSingleExpression = false;
      process.expression = "0.4*" + ids[0] + "+0.6*" + ids[2];
      process.expression1 = "0.4*" + ids[1] + "+0.3*" + ids[0] + "+0.3*" + ids[2];
      process.expression2 = ids[1];
      process.expression3 = "";
      process.symbols = "";
      process.generateOutput = true;
      process.singleThreaded = false;
      process.use64BitWorkingImage = true;
      process.rescale = false;
      process.truncate = false;
      process.createNewImage = false;
      if ( !process.executeOn( output.mainView ) )
         throw new Error( "PixelMath did not complete (failed or cancelled)." );
      output.show();
      return output;
   }
   catch ( error )
   {
      if ( output != null && !output.isNull )
         output.forceClose();
      throw error;
   }
}

function SHOToRGBStarsDialog()
{
   this.__base__ = Dialog;
   this.__base__();
   var dialog = this;
   this.windowTitle = TITLE + " " + VERSION;
   this.sizer = new VerticalSizer;
   this.sizer.margin = 10;
   this.sizer.spacing = 8;

   this.info = new Label( this );
   this.info.text = "Select aligned monochrome main images. Use stars-only Ha, OIII and SII for a stars-only result. Full masters also retain nebulosity. Starless sources cannot recreate missing stars.\n\n" +
      "R = 0.4*Ha + 0.6*SII\nG = 0.4*OIII + 0.3*Ha + 0.3*SII\nB = OIII\n\n" +
      "Synthetic colour is approximate. Use consistently processed sources, preferably linear. No stretch, rescale or clipping is applied.";
   this.info.wordWrapping = true;
   this.sizer.add( this.info );

   this.selectors = [];
   var names = ["Ha:", "OIII:", "SII:"];
   var windows = ImageWindow.windows;
   for ( var c = 0; c < 3; ++c )
   {
      var row = new HorizontalSizer;
      row.spacing = 8;
      var label = new Label( this );
      label.text = names[c];
      label.setFixedWidth( 55 );
      var combo = new ComboBox( this );
      combo.addItem( "<Select image>" );
      for ( var i = 0; i < windows.length; ++i )
         combo.addItem( windows[i].mainView.id );
      combo.currentItem = 0;
      row.add( label );
      row.add( combo, 100 );
      this.selectors.push( combo );
      this.sizer.add( row );
   }

   var outputRow = new HorizontalSizer;
   outputRow.spacing = 8;
   this.outputLabel = new Label( this );
   this.outputLabel.text = "Output ID:";
   this.outputEdit = new Edit( this );
   this.outputEdit.text = nextOutputId();
   outputRow.add( this.outputLabel );
   outputRow.add( this.outputEdit, 100 );
   this.sizer.add( outputRow );

   this.confirm = new CheckBox( this );
   this.confirm.text = "Sources contain stars and share the same alignment, crop and pixel scale";
   this.confirm.toolTip = "Equal dimensions cannot prove registration or detect starless data. Check these conditions yourself before creating the image.";
   this.sizer.add( this.confirm );
   this.createButton = new PushButton( this );
   this.createButton.text = "Create RGB Image";
   this.createButton.onClick = function()
   {
      try
      {
         if ( !dialog.confirm.checked )
            throw new Error( "Confirm that the sources contain stars and have matching alignment, crop and pixel scale. Starless data cannot restore stars." );
         var ids = [];
         for ( var i = 0; i < 3; ++i )
            ids.push( dialog.selectors[i].currentItem > 0 ?
                      dialog.selectors[i].itemText( dialog.selectors[i].currentItem ) : "" );
         dialog.createButton.enabled = false;
         var output = createRGBStars( ids, dialog.outputEdit.text.trim() );
         Console.writeln( TITLE + ": created " + output.mainView.id + " from Ha=" + ids[0] + ", OIII=" + ids[1] + ", SII=" + ids[2] + "." );
         dialog.ok();
      }
      catch ( error )
      {
         (new MessageBox( error.message || String( error ), TITLE, 4, 1 )).execute();
      }
      finally
      {
         dialog.createButton.enabled = true;
      }
   };
   this.closeButton = new PushButton( this );
   this.closeButton.text = "Close";
   this.closeButton.onClick = function() { dialog.cancel(); };
   var buttons = new HorizontalSizer;
   buttons.spacing = 8;
   buttons.addStretch();
   buttons.add( this.createButton );
   buttons.add( this.closeButton );
   this.sizer.add( buttons );
   this.setFixedWidth( 620 );
   this.adjustToContents();
}
SHOToRGBStarsDialog.prototype = new Dialog;

function main()
{
   if ( ImageWindow.windows.length < 3 )
   {
      (new MessageBox( "Open three aligned monochrome Ha, OIII and SII images first.", TITLE, 4, 1 )).execute();
      return;
   }
   (new SHOToRGBStarsDialog).execute();
}

main();
