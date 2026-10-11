// Copyright (c) 2026 Ian Steane. All rights reserved.
// PixInsight JavaScript Runtime script.
#feature-id StarRecombine : Chapel Astro Utilities > StarRecombine
#feature-info Recombine starless and stars-only images with an adjustable preview.

function HorizontalSizer() { this.__base__ = Sizer; this.__base__( false ); }
HorizontalSizer.prototype = new Sizer;
function VerticalSizer() { this.__base__ = Sizer; this.__base__( true ); }
VerticalSizer.prototype = new Sizer;

function availableId( base )
{
   var id = base, n = 1;
   while ( !View.viewById( id ).isNull ) id = base + "_" + n++;
   return id;
}

function validateSources( a, b )
{
   if ( a.isNull || b.isNull ) throw new Error( "Select two open images." );
   if ( a.id == b.id ) throw new Error( "Select different starless and stars-only images." );
   if ( a.image.width != b.image.width || a.image.height != b.image.height ||
        a.image.numberOfNominalChannels != b.image.numberOfNominalChannels ||
        a.image.isColor != b.image.isColor )
      throw new Error( "The images must have matching dimensions and colour channels." );
   if ( a.image.isComplex || b.image.isComplex )
      throw new Error( "Complex images are not supported." );
}

function recombine( a, b, percent, base, show )
{
   validateSources( a, b );
   var id = availableId( base );
   var p = new PixelMath;
   // Screen blend; clamp boosted stars before blending to keep the result bounded.
   p.expression = "~((~" + a.id + ")*(~min(1,max(0," +
                  (percent/100).toFixed( 6 ) + "*" + b.id + "))))";
   p.useSingleExpression = true;
   p.generateOutput = true;
   p.createNewImage = true;
   p.showNewImage = false;
   p.newImageId = id;
   p.newImageWidth = 0;
   p.newImageHeight = 0;
   p.newImageAlpha = false;
   // Defaults inherit the target colour space; use explicit 32-bit float output.
   p.newImageSampleFormat = typeof PixelMath.f32 != "undefined" ?
      PixelMath.f32 : PixelMath.prototype.f32;
   p.rescale = false;
   p.truncate = true;
   p.truncateLower = 0;
   p.truncateUpper = 1;
   var result = null;
   try
   {
      if ( !p.executeOn( a, false ) ) throw new Error( "PixelMath execution failed." );
      result = ImageWindow.windowById( id );
      if ( result.isNull ) throw new Error( "PixelMath did not create the output image." );
      if ( show ) { result.show(); result.zoomToFit(); }
      return result;
   }
   catch ( e )
   {
      var partial = ImageWindow.windowById( id );
      if ( !partial.isNull ) partial.forceClose();
      throw e;
   }
}

function initializeStarRecombineDialog()
{
   var self = this;
   this.windowTitle = "StarRecombine 1.0.1";
   this.bitmap = null;
   this.previewKey = "";
   this.busy = false;
   this.panX = 0;
   this.panY = 0;
   this.drag = null;
   var views = [];
   var windows = ImageWindow.windows;
   for ( var i = 0; i < windows.length; ++i ) views.push( windows[i].mainView );

   this.help = new Label( this );
   this.help.text = "Select matching, stretched starless and stars-only images. " +
      "100% uses your original screen-blend formula. 0% removes the stars. " +
      "Preview updates after you release the slider; large images may take a moment.";
   this.help.wordWrapping = true;

   this.starless = new ComboBox( this );
   this.stars = new ComboBox( this );
   for ( var j = 0; j < views.length; ++j )
   {
      this.starless.addItem( views[j].id );
      this.stars.addItem( views[j].id );
      if ( /starless/i.test( views[j].id ) ) this.starless.currentItem = j;
      else if ( /stars/i.test( views[j].id ) ) this.stars.currentItem = j;
   }
   if ( this.starless.currentItem == this.stars.currentItem )
      this.stars.currentItem = this.starless.currentItem == 0 ? 1 : 0;

   function sourceRow( text, combo )
   {
      var label = new Label( self ); label.text = text; label.setFixedWidth( 90 );
      var row = new HorizontalSizer; row.spacing = 8;
      row.add( label ); row.add( combo, 100 ); return row;
   }
   this.slider = new Slider( this );
   this.slider.setRange( 0, 200 ); this.slider.value = 100;
   this.amount = new SpinBox( this );
   this.amount.minValue = 0; this.amount.maxValue = 200; this.amount.value = 100;
   this.amount.suffix = "%";
   this.intensityLabel = new Label( this ); this.intensityLabel.text = "Star intensity:";
   this.intensityRow = new HorizontalSizer; this.intensityRow.spacing = 8;
   this.intensityRow.add( this.intensityLabel );
   this.intensityRow.add( this.slider, 100 ); this.intensityRow.add( this.amount );

   this.preview = new Control( this );
   this.preview.setMinSize( 640, 400 );
   this.preview.onPaint = function()
   {
      var g = new Graphics( this );
      try
      {
         g.fillRect( this.boundsRect, 0xff181818 );
         if ( self.bitmap != null )
         {
            var scale = self.actualSize.checked ? 1 :
               Math.min( this.width/self.bitmap.width, this.height/self.bitmap.height );
            var w = self.bitmap.width*scale, h = self.bitmap.height*scale;
            var x = (this.width-w)/2 + (self.actualSize.checked ? self.panX : 0);
            var y = (this.height-h)/2 + (self.actualSize.checked ? self.panY : 0);
            g.drawScaledBitmap( new Rect( x, y, x+w, y+h ), self.bitmap );
         }
      }
      finally { g.end(); }
   };
   this.preview.onMousePress = function( x, y )
   { if ( self.actualSize.checked ) self.drag = { x:x, y:y }; };
   this.preview.onMouseMove = function( x, y )
   {
      if ( self.drag != null )
      {
         self.panX += x-self.drag.x; self.panY += y-self.drag.y;
         self.drag = { x:x, y:y }; self.preview.update();
      }
   };
   this.preview.onMouseRelease = function() { self.drag = null; };
   this.actualSize = new CheckBox( this );
   this.actualSize.text = "100% view (drag preview to pan)";
   this.actualSize.onCheck = function() { self.panX = self.panY = 0; self.preview.update(); };
   this.status = new Label( this );
   this.status.text = "Click Preview to display the selected combination.";
   this.status.wordWrapping = true;

   this.refresh = function()
   {
      if ( self.busy ) return;
      self.busy = true;
      self.create.enabled = false;
      var temp = null;
      try
      {
         temp = recombine( views[self.starless.currentItem], views[self.stars.currentItem],
                           self.amount.value, "StarRecombinePreview", false );
         var bitmap = temp.mainView.image.render();
         self.bitmap = bitmap;
         self.previewKey = self.starless.currentItem + ":" + self.stars.currentItem + ":" + self.amount.value;
         self.status.text = "Preview: " + self.amount.value + "% stars. Display uses actual pixel values (no STF).";
         self.create.enabled = true;
      }
      catch ( e )
      {
         self.bitmap = null; self.previewKey = "";
         self.status.text = e.message;
      }
      finally
      {
         if ( temp != null && !temp.isNull ) temp.forceClose();
         self.busy = false; self.preview.update();
      }
   };
   this.invalidate = function()
   {
      self.create.enabled = false;
      self.status.text = "Preview needs updating.";
   };
   this.slider.onValueUpdated = function( value )
   { self.amount.value = value; self.invalidate(); };
   this.slider.onMouseRelease = function() { self.refresh(); };
   this.amount.onValueUpdated = function( value )
   { self.slider.value = value; self.invalidate(); self.refresh(); };
   this.starless.onItemSelected = this.stars.onItemSelected = function()
   { self.panX = self.panY = 0; self.invalidate(); self.refresh(); };

   this.previewButton = new PushButton( this ); this.previewButton.text = "Preview";
   this.previewButton.onClick = function() { self.refresh(); };
   this.create = new PushButton( this ); this.create.text = "Create Recombined";
   this.create.enabled = false;
   this.create.onClick = function()
   {
      var key = self.starless.currentItem + ":" + self.stars.currentItem + ":" + self.amount.value;
      if ( key != self.previewKey ) { self.refresh(); return; }
      try
      {
         var output = recombine( views[self.starless.currentItem], views[self.stars.currentItem],
                                 self.amount.value, "Recombined", true );
         Console.writeln( "Created " + output.mainView.id + " with " + self.amount.value + "% stars." );
         self.ok();
      }
      catch ( e ) { self.status.text = e.message; }
   };
   this.close = new PushButton( this ); this.close.text = "Cancel";
   this.close.onClick = function() { self.cancel(); };
   this.buttons = new HorizontalSizer; this.buttons.spacing = 8;
   this.buttons.add( this.previewButton ); this.buttons.addStretch();
   this.buttons.add( this.create ); this.buttons.add( this.close );
   this.sizer = new VerticalSizer; this.sizer.margin = 10; this.sizer.spacing = 8;
   this.sizer.add( this.help );
   this.sizer.add( sourceRow( "Starless:", this.starless ) );
   this.sizer.add( sourceRow( "Stars only:", this.stars ) );
   this.sizer.add( this.intensityRow ); this.sizer.add( this.preview, 100 );
   this.sizer.add( this.actualSize ); this.sizer.add( this.status ); this.sizer.add( this.buttons );
   this.adjustToContents();
}
function StarRecombineDialog()
{
   this.__base__ = Dialog;
   this.__base__();
   initializeStarRecombineDialog.call( this );
}
StarRecombineDialog.prototype = new Dialog;

function main()
{
   if ( ImageWindow.windows.length < 2 )
   {
      (new MessageBox( "Open your starless and stars-only images first.", "StarRecombine", 4, 1 )).execute();
      return;
   }
   var dialog = new StarRecombineDialog;
   dialog.execute();
}
main();
