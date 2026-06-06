// ImageRenameByFilter.js
//
// PixInsight JavaScript Runtime script.
//
// Rename open image windows by matching configurable filename/view-id tokens to
// short filter names. Mappings are persisted in PixInsight settings.

#feature-id    ImageRenameByFilter : Chapel Astro Utilities > ImageRenameByFilter
#feature-info  Rename open master light images by filter mapping, with optional save-as output.

#include <pjsr/DataType.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/UndoFlag.jsh>

#define TITLE "ImageRenameByFilter"
#define VERSION "1.0.0"

#define SETTINGS_ROOT "GrandPaClanger/ImageRenameByFilter"

var DEFAULT_MAPPINGS =
   "Luminance,L\n" +
   "Red,R\n" +
   "Green,G\n" +
   "Blue,B\n" +
   "Sulphur,S\n" +
   "Hydrogen,H\n" +
   "Oxygen,O\n";

function trimString( s )
{
   return s.replace( /^\s+|\s+$/g, "" );
}

function stringOrEmpty( value )
{
   return typeof value == "string" ? value : "";
}

function settingReadString( key, fallback )
{
   try
   {
      var value = Settings.read( SETTINGS_ROOT + "/" + key, DataType_String );
      if ( Settings.lastReadOK && typeof value == "string" && value.length > 0 )
         return value;
   }
   catch ( error )
   {
   }

   return fallback;
}

function settingWriteString( key, value )
{
   try
   {
      Settings.write( SETTINGS_ROOT + "/" + key, DataType_String, value );
   }
   catch ( error )
   {
      Console.warningln( "Could not save setting '" + key + "': " + error.message );
   }
}

function saveSettings( mappingsText, saveImages, outputDirectory, suffix, postSaveAction, openSavedImages, renameMode )
{
   settingWriteString( "mappings", mappingsText );
   settingWriteString( "saveImages", saveImages ? "true" : "false" );
   settingWriteString( "outputDirectory", outputDirectory );
   settingWriteString( "postSaveAction", postSaveAction );
   settingWriteString( "openSavedImages", openSavedImages ? "true" : "false" );
}

function parseCsvLine( line )
{
   var fields = new Array;
   var field = "";
   var quoted = false;

   for ( var i = 0; i < line.length; ++i )
   {
      var c = line.charAt( i );

      if ( c == '"' )
      {
         if ( quoted && i + 1 < line.length && line.charAt( i + 1 ) == '"' )
         {
            field += '"';
            ++i;
         }
         else
            quoted = !quoted;
      }
      else if ( c == "," && !quoted )
      {
         fields.push( trimString( field ) );
         field = "";
      }
      else
         field += c;
   }

   fields.push( trimString( field ) );
   return fields;
}

function parseMappings( text )
{
   var mappings = new Array;
   var lines = text.replace( /\r\n/g, "\n" ).replace( /\r/g, "\n" ).split( "\n" );

   for ( var i = 0; i < lines.length; ++i )
   {
      var line = trimString( lines[i] );

      if ( line.length == 0 || line.charAt( 0 ) == "#" )
         continue;

      var fields = parseCsvLine( line );
      if ( fields.length < 2 )
         throw new Error( "Mapping line " + (i + 1).toString() +
                          " must be CSV: text to find, new image name." );

      if ( fields[0].length == 0 || fields[1].length == 0 )
         throw new Error( "Mapping line " + (i + 1).toString() +
                          " has an empty match or image name." );

      mappings.push( {
         match: fields[0],
         imageId: fields[1],
         line: i + 1
      } );
   }

   if ( mappings.length == 0 )
      throw new Error( "Add at least one mapping line." );

   return mappings;
}

function mappingsToText( mappings )
{
   var lines = new Array;

   for ( var i = 0; i < mappings.length; ++i )
      lines.push( mappings[i].match + "," + mappings[i].imageId );

   return lines.join( "\n" ) + "\n";
}

function sanitizeViewId( id )
{
   var result = trimString( id ).replace( /[^A-Za-z0-9_]/g, "_" );
   result = result.replace( /_+/g, "_" ).replace( /^_+|_+$/g, "" );

   if ( result.length == 0 )
      result = "Image";

   if ( !/^[A-Za-z_]/.test( result ) )
      result = "_" + result;

   return result;
}

function setControlBold( control, bold )
{
   try
   {
      var font = control.font;
      font.bold = bold;
      control.font = font;
   }
   catch ( error )
   {
   }
}

function sanitizeOptionalSuffix( suffix )
{
   if ( trimString( suffix ).length == 0 )
      return "";

   return sanitizeViewId( suffix );
}

function suffixViewId( id, suffix )
{
   var cleanSuffix = sanitizeOptionalSuffix( suffix );

   if ( cleanSuffix.length == 0 )
      return sanitizeViewId( id );

   return sanitizeViewId( id + "_" + cleanSuffix );
}

function windowFilePath( window )
{
   try
   {
      if ( typeof window.filePath == "string" )
         return window.filePath;
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.currentFilePath == "string" )
         return window.currentFilePath;
   }
   catch ( error2 )
   {
   }

   return "";
}

function windowSearchText( window )
{
   var text = window.mainView.id;
   var filePath = windowFilePath( window );

   if ( filePath.length > 0 )
      text += " " + filePath;

   try
   {
      if ( typeof window.caption == "string" )
         text += " " + window.caption;
   }
   catch ( error )
   {
   }

   return text;
}

function directoryOfPath( filePath )
{
   var slash = Math.max( filePath.lastIndexOf( "/" ), filePath.lastIndexOf( "\\" ) );
   return slash >= 0 ? filePath.substring( 0, slash ) : "";
}

function extensionOfPath( filePath )
{
   var slash = Math.max( filePath.lastIndexOf( "/" ), filePath.lastIndexOf( "\\" ) );
   var dot = filePath.lastIndexOf( "." );

   if ( dot > slash )
      return filePath.substring( dot );

   return ".xisf";
}

function joinPath( directory, fileName )
{
   if ( directory.length == 0 )
      return fileName;

   var last = directory.charAt( directory.length - 1 );
   if ( last == "/" || last == "\\" )
      return directory + fileName;

   return directory + "/" + fileName;
}

function findMapping( window, mappings )
{
   var text = windowSearchText( window ).toLowerCase();
   var best = null;

   for ( var i = 0; i < mappings.length; ++i )
      if ( text.indexOf( mappings[i].match.toLowerCase() ) >= 0 )
         if ( best == null || mappings[i].match.length > best.match.length )
            best = mappings[i];

   return best;
}

function existingViewIds()
{
   var ids = {};
   var windows = ImageWindow.windows;

   for ( var i = 0; i < windows.length; ++i )
      ids[windows[i].mainView.id] = true;

   return ids;
}

function isCollapsedWindow( window )
{
   try
   {
      if ( typeof window.isIconic == "boolean" && window.isIconic )
         return true;
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.iconic == "boolean" && window.iconic )
         return true;
   }
   catch ( error2 )
   {
   }

   try
   {
      if ( typeof window.isVisible == "boolean" && !window.isVisible )
         return true;
   }
   catch ( error3 )
   {
   }

   try
   {
      if ( typeof window.isShaded == "boolean" && window.isShaded )
         return true;
   }
   catch ( error4 )
   {
   }

   return false;
}

function allocateViewId( requestedId, allocated, currentId )
{
   var base = sanitizeViewId( requestedId );
   var candidate = base;
   var suffix = 2;

   while ( allocated[candidate] && candidate != currentId )
   {
      candidate = base + "_" + suffix.toString();
      ++suffix;
   }

   allocated[candidate] = true;
   return candidate;
}

function buildPlan( mappings, suffix, previousSelections, renameMode )
{
   var windows = ImageWindow.windows;
   var allocated = existingViewIds();
   var plan = new Array;

   for ( var i = 0; i < windows.length; ++i )
   {
      var window = windows[i];
      var currentId = window.mainView.id;
      var mapping = findMapping( window, mappings );
      var sourcePath = windowFilePath( window );
      var newId = "";
      var selected = !isCollapsedWindow( window );

      if ( renameMode == "suffixOnly" )
      {
         newId = allocateViewId( suffixViewId( currentId, suffix ), allocated, currentId );
         mapping = {
            match: "current name",
            imageId: currentId,
            line: 0,
            suffixOnly: true
         };
      }
      else if ( mapping != null )
         newId = allocateViewId( suffixViewId( mapping.imageId, suffix ), allocated, currentId );

      if ( previousSelections != null && typeof previousSelections[currentId] == "boolean" )
         selected = previousSelections[currentId];

      plan.push( {
         window: window,
         currentId: currentId,
         sourcePath: sourcePath,
         sourceDirectory: directoryOfPath( sourcePath ),
         extension: extensionOfPath( sourcePath ),
         mapping: mapping,
         newId: newId,
         selected: selected,
         collapsed: isCollapsedWindow( window ),
         savePath: "",
         displayGeometry: null,
         savedWindow: null
      } );
   }

   return plan;
}

function defaultOutputDirectory( plan )
{
   for ( var i = 0; i < plan.length; ++i )
      if ( plan[i].mapping != null && plan[i].sourceDirectory.length > 0 )
         return plan[i].sourceDirectory;

   return settingReadString( "outputDirectory", "" );
}

function previewStatus( item, saveImages, outputDirectory )
{
   if ( !item.selected )
      return item.collapsed ? "Skipped collapsed" : "Skipped";

   if ( item.mapping == null )
      return "No mapping";

   if ( saveImages && outputDirectory.length == 0 && item.sourceDirectory.length == 0 )
      return "Needs output folder";

   if ( item.newId != item.mapping.imageId )
      return "Will rename uniquely";

   return "Ready";
}

function fillPreview( treeBox, plan, saveImages, outputDirectory )
{
   treeBox.clear();

   for ( var i = 0; i < plan.length; ++i )
   {
      var item = plan[i];
      var node = new TreeBoxNode( treeBox );

      node.__planIndex = i;
      node.checkable = true;
      node.checked = item.selected;
      node.setText( 0, item.currentId );
      node.setText( 1, item.mapping != null ? item.mapping.match : "" );
      node.setText( 2, item.newId );
      node.setText( 3, previewStatus( item, saveImages, outputDirectory ) );
   }

   try
   {
      treeBox.setColumnWidth( 0, 245 );
      treeBox.setColumnWidth( 1, 170 );
      treeBox.setColumnWidth( 2, 220 );
      treeBox.setColumnWidth( 3, 110 );
   }
   catch ( error )
   {
   }
}

function setPreviewSelections( treeBox, plan, selected )
{
   try
   {
      for ( var i = 0; i < treeBox.numberOfChildren; ++i )
      {
         var node = treeBox.child( i );
         if ( node != null && typeof node.__planIndex == "number" )
         {
            node.checked = selected;
            plan[node.__planIndex].selected = selected;
         }
      }
   }
   catch ( error )
   {
   }
}

function capturePreviewSelections( treeBox, plan )
{
   var selections = {};

   for ( var i = 0; i < plan.length; ++i )
      selections[plan[i].currentId] = plan[i].selected;

   try
   {
      for ( var j = 0; j < treeBox.numberOfChildren; ++j )
      {
         var node = treeBox.child( j );
         if ( node != null && typeof node.__planIndex == "number" )
            selections[plan[node.__planIndex].currentId] = node.checked;
      }
   }
   catch ( error )
   {
   }

   return selections;
}

function countMatched( plan )
{
   var n = 0;

   for ( var i = 0; i < plan.length; ++i )
      if ( plan[i].selected && plan[i].mapping != null )
         ++n;

   return n;
}

function countSelected( plan )
{
   var n = 0;

   for ( var i = 0; i < plan.length; ++i )
      if ( plan[i].selected )
         ++n;

   return n;
}

function outputSavePath( item, outputDirectory )
{
   var directory = outputDirectory.length > 0 ? outputDirectory : item.sourceDirectory;
   return joinPath( directory, item.newId + item.extension );
}

function overwriteSelectedCurrentFiles( plan )
{
   var selected = 0;
   var missingPath = new Array;

   for ( var i = 0; i < plan.length; ++i )
      if ( plan[i].selected )
      {
         ++selected;

         if ( plan[i].sourcePath.length == 0 )
            missingPath.push( plan[i].currentId );
      }

   if ( selected == 0 )
   {
      (new MessageBox( "Select at least one image in the preview before saving.",
                       TITLE, StdIcon_Information, StdButton_Ok )).execute();
      return;
   }

   if ( missingPath.length > 0 )
      throw new Error( "The following selected image(s) do not expose an existing file path and cannot be overwritten in place:\n\n" +
                       missingPath.join( "\n" ) );

   var message =
      "Overwrite the existing files for " + selected.toString() +
      " selected image(s)?\n\n" +
      "This saves each selected open image back to its current file path.";

   if ( (new MessageBox( message, TITLE, StdIcon_Warning,
                         StdButton_Yes, StdButton_No )).execute() != StdButton_Yes )
      return;

   Console.show();
   Console.writeln( "<end><cbr><br>" + TITLE + " " + VERSION );
   Console.writeln( "Saving and overwriting selected image files." );

   for ( var j = 0; j < plan.length; ++j )
      if ( plan[j].selected )
      {
         removeFileIfExists( plan[j].sourcePath );
         saveWindowAs( plan[j].window, plan[j].sourcePath );
         Console.writeln( "Overwrote " + plan[j].sourcePath );
      }

   Console.writeln( "Done. Overwrote " + selected.toString() + " selected image file(s)." );
}

function confirmOverwrites( plan, outputDirectory )
{
   var overwriteCount = 0;

   for ( var i = 0; i < plan.length; ++i )
   {
      var item = plan[i];
      if ( item.selected && item.mapping != null )
      {
         var directory = outputDirectory.length > 0 ? outputDirectory : item.sourceDirectory;
         if ( directory.length > 0 && savePathExists( outputSavePath( item, outputDirectory ) ) )
            ++overwriteCount;
      }
   }

   if ( overwriteCount == 0 )
      return true;

   var overwriteMessage =
      overwriteCount.toString() + " output file(s) already exist.\n\n" +
      "Overwrite existing files for this batch?";

   return (new MessageBox( overwriteMessage, TITLE, StdIcon_Warning,
                           StdButton_Yes, StdButton_No )).execute() == StdButton_Yes;
}

function savePathExists( path )
{
   try
   {
      if ( typeof File != "undefined" && typeof File.exists == "function" )
         return File.exists( path );
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof File != "undefined" && typeof File.fileExists == "function" )
         return File.fileExists( path );
   }
   catch ( error2 )
   {
   }

   return false;
}

function removeFileIfExists( path )
{
   if ( !savePathExists( path ) )
      return;

   try
   {
      if ( typeof File != "undefined" && typeof File.remove == "function" )
      {
         File.remove( path );
         return;
      }
   }
   catch ( error1 )
   {
      throw new Error( "Could not remove existing output file:\n" +
                       path + "\n\n" + error1.message );
   }

   throw new Error( "Cannot overwrite existing output file because this PixInsight build did not expose File.remove():\n" + path );
}

function saveWindowAs( window, path )
{
   window.saveAs( path, false, false, true, false );
}

function duplicateWindow( window, id )
{
   try
   {
      var sourceImage = window.mainView.image;
      var isReal = typeof sourceImage.isReal == "boolean" ?
         sourceImage.isReal :
         (typeof sourceImage.sampleType != "undefined" ? sourceImage.sampleType == SampleType_Real : true);
      var isColor = typeof sourceImage.isColor == "boolean" ?
         sourceImage.isColor :
         sourceImage.numberOfChannels > 1;
      var bitsPerSample = typeof sourceImage.bitsPerSample == "number" ?
         sourceImage.bitsPerSample :
         32;
      var copy = new ImageWindow( sourceImage.width,
                                  sourceImage.height,
                                  sourceImage.numberOfChannels,
                                  bitsPerSample,
                                  isReal,
                                  isColor,
                                  id );
      copy.mainView.beginProcess( UndoFlag_NoSwapFile );
      copy.mainView.image.assign( sourceImage );
      copy.mainView.endProcess();
      copy.mainView.id = id;
      cleanCaption( copy, id );
      return copy;
   }
   catch ( error )
   {
      throw new Error( "Could not create a temporary copy of " +
                       window.mainView.id + " for saving:\n\n" +
                       error.message );
   }
}

function cleanCaption( window, id )
{
   try
   {
      if ( typeof window.caption == "string" )
         window.caption = id;
   }
   catch ( error )
   {
   }
}

function captureDisplayGeometry( window )
{
   var geometry = {
      hasSize: false,
      width: 0,
      height: 0,
      hasFrameRect: false,
      frameWidth: 0,
      frameHeight: 0,
      zoom: 0
   };

   try
   {
      geometry.zoom = window.zoomFactor;
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.width == "number" && typeof window.height == "number" )
      {
         geometry.hasSize = true;
         geometry.width = window.width;
         geometry.height = window.height;
      }
   }
   catch ( error2 )
   {
   }

   try
   {
      if ( typeof window.frameRect != "undefined" )
      {
         geometry.hasFrameRect = true;
         geometry.frameWidth = window.frameRect.width;
         geometry.frameHeight = window.frameRect.height;
      }
   }
   catch ( error3 )
   {
      geometry.hasFrameRect = false;
   }

   return geometry;
}

function showWindow( window )
{
   try
   {
      if ( typeof window.show == "function" )
      {
         window.show();
         return;
      }
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.Show == "function" )
         window.Show();
   }
   catch ( error2 )
   {
   }
}

function bringWindowToFront( window )
{
   try
   {
      if ( typeof window.bringToFront == "function" )
      {
         window.bringToFront();
         return;
      }
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.BringToFront == "function" )
         window.BringToFront();
   }
   catch ( error2 )
   {
   }
}

function applyDisplayGeometry( window, geometry )
{
   if ( geometry == null )
      return;

   try
   {
      if ( geometry.hasSize && typeof window.resize == "function" )
         window.resize( geometry.width, geometry.height );
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( geometry.hasFrameRect &&
           typeof window.frameRect != "undefined" &&
           typeof window.position != "undefined" )
      {
         var p = window.position;
         window.frameRect = new Rect( p.x,
                                      p.y,
                                      p.x + geometry.frameWidth,
                                      p.y + geometry.frameHeight );
      }
   }
   catch ( error2 )
   {
   }

   try
   {
      window.zoomFactor = geometry.zoom;
   }
   catch ( error3 )
   {
   }
}

function ensureDirectory( directory )
{
   if ( directory.length == 0 )
      return;

   try
   {
      if ( typeof File != "undefined" &&
           typeof File.directoryExists == "function" &&
           typeof File.createDirectory == "function" &&
           !File.directoryExists( directory ) )
         File.createDirectory( directory, true );
   }
   catch ( error )
   {
      throw new Error( "Could not create output folder:\n" + directory + "\n\n" +
                       error.message );
   }
}

function collapseWindow( window )
{
   try
   {
      if ( typeof window.iconize == "function" )
      {
         window.iconize();
         return true;
      }
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.Iconize == "function" )
      {
         window.Iconize();
         return true;
      }
   }
   catch ( error2 )
   {
   }

   try
   {
      if ( typeof window.hide == "function" )
      {
         window.hide();
         return true;
      }
   }
   catch ( error3 )
   {
   }

   try
   {
      if ( typeof window.Hide == "function" )
      {
         window.Hide();
         return true;
      }
   }
   catch ( error4 )
   {
   }

   return false;
}

function closeWindow( window )
{
   try
   {
      if ( typeof window.forceClose == "function" )
      {
         window.forceClose();
         return true;
      }
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.ForceClose == "function" )
      {
         window.ForceClose();
         return true;
      }
   }
   catch ( error2 )
   {
   }

   try
   {
      if ( typeof window.close == "function" )
         return window.close();
   }
   catch ( error3 )
   {
   }

   try
   {
      if ( typeof window.Close == "function" )
         return window.Close();
   }
   catch ( error4 )
   {
   }

   return false;
}

function openImageWindows( path, id )
{
   try
   {
      if ( typeof ImageWindow.open == "function" )
         return ImageWindow.open( path );
   }
   catch ( error1 )
   {
      Console.warningln( "ImageWindow.open failed for " + path + ": " + error1.message );
   }

   try
   {
      if ( typeof ImageWindow.Open == "function" )
         return ImageWindow.Open( path );
   }
   catch ( error2 )
   {
      Console.warningln( "ImageWindow.Open failed for " + path + ": " + error2.message );
   }

   try
   {
      if ( typeof ImageWindow.open == "function" )
         return ImageWindow.open( path, id );
   }
   catch ( error3 )
   {
      Console.warningln( "ImageWindow.open(path,id) failed for " + path + ": " + error3.message );
   }

   try
   {
      if ( typeof ImageWindow.Open == "function" )
         return ImageWindow.Open( path, id );
   }
   catch ( error4 )
   {
      Console.warningln( "ImageWindow.Open(path,id) failed for " + path + ": " + error4.message );
   }

   return new Array;
}

function openedWindowAt( opened, index )
{
   try
   {
      if ( opened == null )
         return null;

      var item = typeof opened.length == "number" ? opened[index] : opened;

      if ( item == null )
         return null;

      if ( typeof item.isNull == "boolean" && item.isNull )
         return null;

      if ( typeof item.mainView != "undefined" )
         return item;

      if ( typeof item.window != "undefined" )
         return item.window;
   }
   catch ( error )
   {
   }

   return null;
}

function openedWindowCount( opened )
{
   try
   {
      if ( opened == null )
         return 0;

      if ( typeof opened.length == "number" )
         return opened.length;

      return 1;
   }
   catch ( error )
   {
   }

   return 0;
}

function hasUsableMainView( window )
{
   try
   {
      if ( window == null )
         return false;

      if ( typeof window.isNull == "boolean" && window.isNull )
         return false;

      if ( typeof window.mainView == "undefined" )
         return false;

      if ( typeof window.mainView.isNull == "boolean" && window.mainView.isNull )
         return false;

      return true;
   }
   catch ( error )
   {
   }

   return false;
}

function openSavedImage( path, id, geometry )
{
   try
   {
      var allocated = existingViewIds();
      var openId = allocateViewId( id, allocated, "" );
      var opened = openImageWindows( path, openId );
      var count = openedWindowCount( opened );
      var openedCount = 0;

      for ( var i = 0; i < count; ++i )
      {
         var window = openedWindowAt( opened, i );

         if ( !hasUsableMainView( window ) )
         {
            Console.warningln( "Skipped a null image window returned while opening " + path + "." );
            continue;
         }

         var openedId = openedCount == 0 ? openId : allocateViewId( id, allocated, "" );

         try
         {
            window.mainView.id = openedId;
         }
         catch ( idError )
         {
            Console.warningln( "Could not set opened image id to " +
                               openedId + ": " + idError.message );
         }

         cleanCaption( window, openedId );
         showWindow( window );
         applyDisplayGeometry( window, geometry );
         bringWindowToFront( window );
         ++openedCount;
      }

      return openedCount;
   }
   catch ( error )
   {
      Console.warningln( "Could not open saved image " + path + ": " + error.message );
   }

   return 0;
}

function applyPlan( plan, saveImages, outputDirectory, postSaveAction, openSavedImages )
{
   var renamed = 0;
   var saved = 0;
   var opened = 0;
   var postActions = new Array;

   Console.show();
   Console.writeln( "<end><cbr><br>" + TITLE + " " + VERSION );

   for ( var i = 0; i < plan.length; ++i )
   {
      var item = plan[i];

      if ( !item.selected )
      {
         Console.writeln( "Skipped " + item.currentId + "." );
         continue;
      }

      if ( item.mapping == null )
      {
         Console.warningln( "No mapping for " + item.currentId + "." );
         continue;
      }

      var copyOnly = saveImages && item.mapping != null && item.mapping.suffixOnly;

      if ( !copyOnly )
      {
         item.window.mainView.id = item.newId;
         cleanCaption( item.window, item.newId );
         ++renamed;
         Console.writeln( "Renamed " + item.currentId + " -> " + item.newId + "." );
      }
      else
      {
         Console.writeln( "Saving " + item.currentId + " as " + item.newId +
                          " without renaming the open source image." );
      }

      if ( saveImages )
      {
         var directory = outputDirectory.length > 0 ? outputDirectory : item.sourceDirectory;

         if ( directory.length == 0 )
            throw new Error( "No output directory is available for " + item.newId + "." );

         ensureDirectory( directory );

         var savePath = outputSavePath( item, outputDirectory );
         item.savePath = savePath;
         var saveWindow = item.window;

         if ( copyOnly )
            saveWindow = duplicateWindow( item.window, item.newId );

         saveWindowAs( saveWindow, savePath );
         if ( copyOnly )
         {
            item.displayGeometry = captureDisplayGeometry( item.window );
            item.savedWindow = saveWindow;
         }
         else
         {
            item.window.mainView.id = item.newId;
            cleanCaption( item.window, item.newId );
            item.displayGeometry = captureDisplayGeometry( item.window );
         }
         ++saved;
         Console.writeln( "Saved " + savePath );

         if ( openSavedImages )
         {
            if ( postSaveAction != "close" )
            {
               item.window.mainView.id = item.currentId;
               cleanCaption( item.window, item.currentId );
            }

            postActions.push( item );
         }
         else if ( copyOnly )
            closeWindow( saveWindow );
      }
   }

   if ( saveImages )
   {
      for ( var j = 0; j < postActions.length; ++j )
      {
         var actionItem = postActions[j];

         if ( postSaveAction == "close" )
            closeWindow( actionItem.window );
         else if ( postSaveAction == "collapse" )
            collapseWindow( actionItem.window );

         if ( actionItem.savedWindow != null )
         {
            showWindow( actionItem.savedWindow );
            applyDisplayGeometry( actionItem.savedWindow, actionItem.displayGeometry );
            bringWindowToFront( actionItem.savedWindow );
            ++opened;
         }
         else
            opened += openSavedImage( actionItem.savePath,
                                      actionItem.newId,
                                      actionItem.displayGeometry );
      }

      if ( !openSavedImages )
         for ( var k = 0; k < plan.length; ++k )
            if ( plan[k].selected && plan[k].mapping != null )
            {
               if ( postSaveAction == "close" )
                  closeWindow( plan[k].window );
               else if ( postSaveAction == "collapse" )
                  collapseWindow( plan[k].window );
            }
   }
   else
   {
      for ( var m = 0; m < plan.length; ++m )
         if ( plan[m].selected && plan[m].mapping != null )
         {
            if ( postSaveAction == "close" )
               closeWindow( plan[m].window );
            else if ( postSaveAction == "collapse" )
               collapseWindow( plan[m].window );
         }
   }

   Console.writeln( "Done. Renamed " + renamed.toString() +
                    " image window(s); saved " + saved.toString() +
                    "; opened " + opened.toString() + "." );
}

function exportParameters( mappingsText, saveImages, outputDirectory, suffix, postSaveAction, openSavedImages, renameMode )
{
   Parameters.set( "version", VERSION );
   Parameters.set( "mappings", mappingsText );
   Parameters.set( "saveImages", saveImages ? "true" : "false" );
   Parameters.set( "outputDirectory", outputDirectory );
   Parameters.set( "suffix", suffix );
   Parameters.set( "postSaveAction", postSaveAction );
   Parameters.set( "openSavedImages", openSavedImages ? "true" : "false" );
   Parameters.set( "renameMode", renameMode );
}

function parametersMappingsText()
{
   if ( Parameters.has( "mappings" ) )
      return Parameters.get( "mappings" );

   return settingReadString( "mappings", DEFAULT_MAPPINGS );
}

function parametersSaveImages()
{
   if ( Parameters.has( "saveImages" ) )
      return Parameters.get( "saveImages" ) == "true";

   return settingReadString( "saveImages", "false" ) == "true";
}

function parametersOutputDirectory()
{
   if ( Parameters.has( "outputDirectory" ) )
      return Parameters.get( "outputDirectory" );

   return settingReadString( "outputDirectory", "" );
}

function parametersSuffix()
{
   if ( Parameters.has( "suffix" ) )
      return Parameters.get( "suffix" );

   return "";
}

function parametersPostSaveAction()
{
   if ( Parameters.has( "postSaveAction" ) )
      return Parameters.get( "postSaveAction" );

   return settingReadString( "postSaveAction", "leave" );
}

function parametersOpenSavedImages()
{
   if ( Parameters.has( "openSavedImages" ) )
      return Parameters.get( "openSavedImages" ) == "true";

   return settingReadString( "openSavedImages", "false" ) == "true";
}

function parametersRenameMode()
{
   if ( Parameters.has( "renameMode" ) )
      return Parameters.get( "renameMode" );

   return "";
}

function ImageRenameByFilterDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   var dialog = this;
   var currentPlan = new Array;
   var mappingRows = parseMappings( parametersMappingsText() );
   var selectedMappingIndex = -1;
   var suffixText = parametersSuffix();
   var renameMode = parametersRenameMode();

   this.windowTitle = TITLE + " " + VERSION;

   this.infoLabel = new Label( this );
   this.infoLabel.text =
      "Rename open image windows by matching text in the view id, filename, or window caption.";
   this.infoLabel.wordWrapping = true;
   this.infoLabel.frameStyle = FrameStyle_Box;
   this.infoLabel.margin = 6;

   this.mappingLabel = new Label( this );
   this.mappingLabel.text = "Rename mappings";

   this.mappingTree = new TreeBox( this );
   this.mappingTree.numberOfColumns = 2;
   this.mappingTree.headerVisible = true;
   this.mappingTree.setHeaderText( 0, "Text to find" );
   this.mappingTree.setHeaderText( 1, "Rename to" );
   this.mappingTree.rootDecoration = false;
   this.mappingTree.alternateRowColor = true;
   this.mappingTree.minHeight = 130;

   this.matchLabel = new Label( this );
   this.matchLabel.text = "Find:";
   this.matchLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.matchEdit = new Edit( this );

   this.nameLabel = new Label( this );
   this.nameLabel.text = "Rename to:";
   this.nameLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.nameEdit = new Edit( this );

   this.addMappingButton = new PushButton( this );
   this.addMappingButton.text = "Add";

   this.updateMappingButton = new PushButton( this );
   this.updateMappingButton.text = "Update";

   this.deleteMappingButton = new PushButton( this );
   this.deleteMappingButton.text = "Delete";

   this.mappingEditSizer = new HorizontalSizer;
   this.mappingEditSizer.spacing = 6;
   this.mappingEditSizer.add( this.matchLabel );
   this.mappingEditSizer.add( this.matchEdit, 100 );
   this.mappingEditSizer.add( this.nameLabel );
   this.mappingEditSizer.add( this.nameEdit, 100 );
   this.mappingEditSizer.add( this.updateMappingButton );
   this.mappingEditSizer.add( this.addMappingButton );
   this.mappingEditSizer.add( this.deleteMappingButton );

   this.mappingSizer = new VerticalSizer;
   this.mappingSizer.spacing = 4;
   this.mappingSizer.add( this.mappingLabel );
   this.mappingSizer.add( this.mappingTree, 100 );
   this.mappingSizer.add( this.mappingEditSizer );

   this.optionsHeaderLabel = new Label( this );
   this.optionsHeaderLabel.text = "Rename / Save Options";
   this.optionsHeaderLabel.frameStyle = FrameStyle_Box;
   this.optionsHeaderLabel.margin = 6;

   this.modeLabel = new Label( this );
   this.modeLabel.text = "Mode:";
   this.modeLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.mappingModeRadio = new RadioButton( this );
   this.mappingModeRadio.text = "Rename By Filter Mappings";
   this.mappingModeRadio.checked = renameMode == "mapping";

   this.suffixOnlyModeRadio = new RadioButton( this );
   this.suffixOnlyModeRadio.text = "Append suffix to current names";
   this.suffixOnlyModeRadio.checked = renameMode == "suffixOnly";

   this.modePromptLabel = new Label( this );
   this.modePromptLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.modeSizer = new HorizontalSizer;
   this.modeSizer.spacing = 6;
   this.modeSizer.add( this.modeLabel );
   this.modeSizer.add( this.mappingModeRadio );
   this.modeSizer.add( this.suffixOnlyModeRadio );
   this.modeSizer.add( this.modePromptLabel );
   this.modeSizer.addStretch();

   this.suffixLabel = new Label( this );
   this.suffixLabel.text = "Suffix:";
   this.suffixLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.suffixEdit = new Edit( this );
   this.suffixEdit.text = sanitizeOptionalSuffix( suffixText );
   this.suffixEdit.toolTip = "Optional suffix added after the mapped name. Invalid PixInsight identifier characters are converted to underscores.";

   this.suffixPreviewLabel = new Label( this );
   this.suffixPreviewLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.suffixSizer = new HorizontalSizer;
   this.suffixSizer.spacing = 6;
   this.suffixSizer.add( this.suffixLabel );
   this.suffixSizer.add( this.suffixEdit, 100 );
   this.suffixSizer.add( this.suffixPreviewLabel );

   this.saveCheckBox = new CheckBox( this );
   this.saveCheckBox.text = "Save images after renaming";
   this.saveCheckBox.checked = parametersSaveImages();

   this.outputLabel = new Label( this );
   this.outputLabel.text = "Folder:";
   this.outputLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.outputEdit = new Edit( this );
   this.outputEdit.text = parametersOutputDirectory();

   this.browseButton = new ToolButton( this );
   this.browseButton.icon = this.scaledResource( ":/icons/select-file.png" );
   this.browseButton.setScaledFixedSize( 24, 24 );
   this.browseButton.toolTip = "Browse for an output folder.";
   this.browseButton.onClick = function()
   {
      var d = new GetDirectoryDialog;
      d.caption = "Select output folder";
      d.initialPath = dialog.outputEdit.text;

      if ( d.execute() )
      {
         dialog.outputEdit.text = d.directory;
         dialog.refreshPreview();
      }
   };

   this.folderSizer = new HorizontalSizer;
   this.folderSizer.spacing = 6;
   this.folderSizer.add( this.outputLabel );
   this.folderSizer.add( this.outputEdit, 100 );
   this.folderSizer.add( this.browseButton );

   this.postSaveLabel = new Label( this );
   this.postSaveLabel.text = "After save:";
   this.postSaveLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.postSaveCombo = new ComboBox( this );
   this.postSaveCombo.addItem( "Leave selected images open" );
   this.postSaveCombo.addItem( "Collapse selected images" );
   this.postSaveCombo.addItem( "Close selected images" );

   var postSaveAction = parametersPostSaveAction();
   if ( postSaveAction == "collapse" )
      this.postSaveCombo.currentItem = 1;
   else if ( postSaveAction == "close" )
      this.postSaveCombo.currentItem = 2;
   else
      this.postSaveCombo.currentItem = 0;

   this.openSavedCheckBox = new CheckBox( this );
   this.openSavedCheckBox.text = "Open newly saved images";
   this.openSavedCheckBox.checked = parametersOpenSavedImages();

   this.postSaveSizer = new HorizontalSizer;
   this.postSaveSizer.spacing = 6;
   this.postSaveSizer.add( this.postSaveLabel );
   this.postSaveSizer.add( this.postSaveCombo, 100 );
   this.postSaveSizer.add( this.openSavedCheckBox );

   this.previewTree = new TreeBox( this );
   this.previewTree.numberOfColumns = 4;
   this.previewTree.headerVisible = true;
   this.previewTree.setHeaderText( 0, "Current" );
   this.previewTree.setHeaderText( 1, "Match" );
   this.previewTree.setHeaderText( 2, "New" );
   this.previewTree.setHeaderText( 3, "Status" );
   this.previewTree.rootDecoration = false;
   this.previewTree.alternateRowColor = true;
   this.previewTree.minHeight = 180;

   this.previewLabel = new Label( this );
   this.previewLabel.text = "Preview";

   this.previewSizer = new VerticalSizer;
   this.previewSizer.spacing = 4;
   this.previewSizer.add( this.previewLabel );
   this.previewSizer.add( this.previewTree, 100 );

   this.mappingsText = function()
   {
      return mappingsToText( mappingRows );
   };

   this.saveDialogSettings = function()
   {
      saveSettings( dialog.mappingsText(),
                    dialog.saveCheckBox.checked,
                    trimString( dialog.outputEdit.text ),
                    sanitizeOptionalSuffix( dialog.suffixEdit.text ),
                    dialog.postSaveAction(),
                    dialog.openSavedCheckBox.checked,
                    dialog.renameMode() );
   };

   this.renameMode = function()
   {
      if ( dialog.mappingModeRadio.checked )
         return "mapping";

      if ( dialog.suffixOnlyModeRadio.checked )
         return "suffixOnly";

      return "";
   };

   this.updateApplyState = function()
   {
      var hasMode = dialog.renameMode().length > 0;
      dialog.applyButton.enabled = hasMode;
      dialog.applyButton.toolTip = hasMode ?
         "Apply the selected rename/save operation." :
         "Select a rename mode before applying.";
      dialog.modePromptLabel.text = hasMode ? "" : "Select a mode to enable Apply";
      setControlBold( dialog.modePromptLabel, !hasMode );
   };

   this.updateSaveOptionVisibility = function()
   {
      var saveVisible = dialog.saveCheckBox.checked;

      try
      {
         dialog.openSavedCheckBox.visible = saveVisible;
      }
      catch ( error1 )
      {
      }

      dialog.postSaveLabel.text = saveVisible ? "After save:" : "After apply:";
      dialog.postSaveLabel.enabled = true;
      dialog.postSaveCombo.enabled = true;
      dialog.openSavedCheckBox.enabled = saveVisible;
   };

   this.postSaveAction = function()
   {
      if ( dialog.postSaveCombo.currentItem == 1 )
         return "collapse";

      if ( dialog.postSaveCombo.currentItem == 2 )
         return "close";

      return "leave";
   };

   this.fillMappingTree = function()
   {
      dialog.mappingTree.clear();

      for ( var i = 0; i < mappingRows.length; ++i )
      {
         var node = new TreeBoxNode( dialog.mappingTree );
         node.__mappingIndex = i;
         node.setText( 0, mappingRows[i].match );
         node.setText( 1, mappingRows[i].imageId );
      }
   };

   this.selectMapping = function( node )
   {
      if ( node == null || typeof node.__mappingIndex != "number" )
         return;

      selectedMappingIndex = node.__mappingIndex;
      dialog.matchEdit.text = mappingRows[selectedMappingIndex].match;
      dialog.nameEdit.text = mappingRows[selectedMappingIndex].imageId;
   };

   this.refreshPreview = function()
   {
      try
      {
         var previousSelections = capturePreviewSelections( dialog.previewTree, currentPlan );
         var effectiveSuffix = sanitizeOptionalSuffix( dialog.suffixEdit.text );
         dialog.suffixPreviewLabel.text =
            effectiveSuffix.length > 0 ? "Suffix active: _" + effectiveSuffix : "";
         setControlBold( dialog.suffixEdit, effectiveSuffix.length > 0 );
         setControlBold( dialog.suffixPreviewLabel, effectiveSuffix.length > 0 );
         currentPlan = buildPlan( mappingRows,
                                  effectiveSuffix,
                                  previousSelections,
                                  dialog.renameMode() );

         if ( dialog.outputEdit.text.length == 0 )
            dialog.outputEdit.text = defaultOutputDirectory( currentPlan );

         fillPreview( dialog.previewTree,
                      currentPlan,
                      dialog.saveCheckBox.checked,
                      trimString( dialog.outputEdit.text ) );
      }
      catch ( error )
      {
         currentPlan = new Array;
         dialog.previewTree.clear();
         (new MessageBox( error.message, TITLE, StdIcon_Error, StdButton_Ok )).execute();
      }
   };

   this.mappingTree.onNodeSelectionUpdated = function( node )
   {
      dialog.selectMapping( node || dialog.mappingTree.currentNode );
   };

   this.mappingTree.onNodeActivated = function( node )
   {
      dialog.selectMapping( node || dialog.mappingTree.currentNode );
   };

   this.addMappingButton.onClick = function()
   {
      var match = trimString( dialog.matchEdit.text );
      var name = trimString( dialog.nameEdit.text );

      if ( match.length == 0 || name.length == 0 )
      {
         (new MessageBox( "Enter both a match value and an image name.",
                          TITLE, StdIcon_Error, StdButton_Ok )).execute();
         return;
      }

      mappingRows.push( {
         match: match,
         imageId: sanitizeViewId( name ),
         line: mappingRows.length + 1
      } );
      selectedMappingIndex = mappingRows.length - 1;
      dialog.fillMappingTree();
      dialog.saveDialogSettings();
      dialog.refreshPreview();
   };

   this.updateMappingButton.onClick = function()
   {
      if ( selectedMappingIndex < 0 || selectedMappingIndex >= mappingRows.length )
      {
         (new MessageBox( "Select a mapping row to update.",
                          TITLE, StdIcon_Information, StdButton_Ok )).execute();
         return;
      }

      var match = trimString( dialog.matchEdit.text );
      var name = trimString( dialog.nameEdit.text );

      if ( match.length == 0 || name.length == 0 )
      {
         (new MessageBox( "Enter both a match value and an image name.",
                          TITLE, StdIcon_Error, StdButton_Ok )).execute();
         return;
      }

      mappingRows[selectedMappingIndex].match = match;
      mappingRows[selectedMappingIndex].imageId = sanitizeViewId( name );
      dialog.fillMappingTree();
      dialog.saveDialogSettings();
      dialog.refreshPreview();
   };

   this.deleteMappingButton.onClick = function()
   {
      if ( selectedMappingIndex < 0 || selectedMappingIndex >= mappingRows.length )
      {
         (new MessageBox( "Select a mapping row to delete.",
                          TITLE, StdIcon_Information, StdButton_Ok )).execute();
         return;
      }

      mappingRows.splice( selectedMappingIndex, 1 );
      selectedMappingIndex = -1;
      dialog.matchEdit.text = "";
      dialog.nameEdit.text = "";
      dialog.fillMappingTree();
      dialog.saveDialogSettings();
      dialog.refreshPreview();
   };

   this.outputEdit.onTextUpdated = function()
   {
      dialog.saveDialogSettings();
      fillPreview( dialog.previewTree,
                   currentPlan,
                   dialog.saveCheckBox.checked,
                   trimString( dialog.outputEdit.text ) );
   };

   this.saveCheckBox.onCheck = function()
   {
      dialog.saveDialogSettings();
      dialog.updateSaveOptionVisibility();
      dialog.refreshPreview();
   };

   this.suffixEdit.onTextUpdated = function()
   {
      dialog.saveDialogSettings();
      dialog.refreshPreview();
   };

   this.mappingModeRadio.onCheck = function()
   {
      if ( dialog.mappingModeRadio.checked )
         dialog.suffixOnlyModeRadio.checked = false;
      dialog.saveDialogSettings();
      dialog.updateApplyState();
      dialog.refreshPreview();
   };

   this.suffixOnlyModeRadio.onCheck = function()
   {
      if ( dialog.suffixOnlyModeRadio.checked )
         dialog.mappingModeRadio.checked = false;
      dialog.saveDialogSettings();
      dialog.updateApplyState();
      dialog.refreshPreview();
   };

   this.postSaveCombo.onItemSelected = function()
   {
      dialog.saveDialogSettings();
   };

   this.openSavedCheckBox.onCheck = function()
   {
      dialog.saveDialogSettings();
   };

   this.resetButton = new PushButton( this );
   this.resetButton.text = "Default Mappings";
   this.resetButton.onClick = function()
   {
      mappingRows = parseMappings( DEFAULT_MAPPINGS );
      selectedMappingIndex = -1;
      dialog.matchEdit.text = "";
      dialog.nameEdit.text = "";
      dialog.fillMappingTree();
      dialog.saveDialogSettings();
      dialog.refreshPreview();
   };

   this.refreshButton = new PushButton( this );
   this.refreshButton.text = "Refresh";
   this.refreshButton.icon = this.scaledResource( ":/icons/reload.png" );
   this.refreshButton.onClick = function()
   {
      dialog.refreshPreview();
   };

   this.selectAllButton = new PushButton( this );
   this.selectAllButton.text = "Select All";
   this.selectAllButton.onClick = function()
   {
      setPreviewSelections( dialog.previewTree, currentPlan, true );
      fillPreview( dialog.previewTree,
                   currentPlan,
                   dialog.saveCheckBox.checked,
                   trimString( dialog.outputEdit.text ) );
   };

   this.unselectAllButton = new PushButton( this );
   this.unselectAllButton.text = "Unselect All";
   this.unselectAllButton.onClick = function()
   {
      setPreviewSelections( dialog.previewTree, currentPlan, false );
      fillPreview( dialog.previewTree,
                   currentPlan,
                   dialog.saveCheckBox.checked,
                   trimString( dialog.outputEdit.text ) );
   };

   this.applyButton = new PushButton( this );
   this.applyButton.text = "Apply";
   this.applyButton.icon = this.scaledResource( ":/icons/execute.png" );
   this.applyButton.defaultButton = true;
   this.applyButton.onClick = function()
   {
      try
      {
         currentPlan = buildPlan( mappingRows,
                                  sanitizeOptionalSuffix( dialog.suffixEdit.text ),
                                  capturePreviewSelections( dialog.previewTree, currentPlan ),
                                  dialog.renameMode() );

         if ( dialog.renameMode().length == 0 )
         {
            (new MessageBox( "Select a rename mode before applying.",
                             TITLE, StdIcon_Information, StdButton_Ok )).execute();
            return;
         }

         var matched = countMatched( currentPlan );
         if ( matched == 0 )
         {
            (new MessageBox( "No open image windows match the current mappings.",
                             TITLE, StdIcon_Information, StdButton_Ok )).execute();
            return;
         }

         var outputDirectory = trimString( dialog.outputEdit.text );
         var message =
            "Rename " + matched.toString() + " image window(s) using the current mappings?";

         if ( dialog.saveCheckBox.checked )
            message += "\n\nImages will also be saved to:\n" +
                       (outputDirectory.length > 0 ? outputDirectory :
                         "each image's source folder, where available");

         if ( (new MessageBox( message, TITLE, StdIcon_Question,
                               StdButton_Yes, StdButton_No )).execute() != StdButton_Yes )
            return;

         if ( dialog.saveCheckBox.checked )
         {
            if ( !confirmOverwrites( currentPlan, outputDirectory ) )
               return;
         }

         saveSettings( dialog.mappingsText(),
                       dialog.saveCheckBox.checked,
                       outputDirectory,
                       sanitizeOptionalSuffix( dialog.suffixEdit.text ),
                       dialog.postSaveAction(),
                       dialog.openSavedCheckBox.checked,
                       dialog.renameMode() );

         dialog.ok();
         applyPlan( currentPlan,
                    dialog.saveCheckBox.checked,
                    outputDirectory,
                    dialog.postSaveAction(),
                    dialog.openSavedCheckBox.checked );
      }
      catch ( error )
      {
         (new MessageBox( error.message, TITLE, StdIcon_Error, StdButton_Ok )).execute();
      }
   };

   this.saveOverwriteButton = new PushButton( this );
   this.saveOverwriteButton.text = "Save && Overwrite";
   this.saveOverwriteButton.icon = this.scaledResource( ":/icons/save.png" );
   this.saveOverwriteButton.toolTip =
      "Save selected open images back to their current file paths, overwriting existing files after one confirmation.";
   this.saveOverwriteButton.onClick = function()
   {
      try
      {
         currentPlan = buildPlan( mappingRows,
                                  sanitizeOptionalSuffix( dialog.suffixEdit.text ),
                                  capturePreviewSelections( dialog.previewTree, currentPlan ),
                                  dialog.renameMode() );
         overwriteSelectedCurrentFiles( currentPlan );
      }
      catch ( error )
      {
         (new MessageBox( error.message, TITLE, StdIcon_Error, StdButton_Ok )).execute();
      }
   };

   this.closeButton = new PushButton( this );
   this.closeButton.text = "Close";
   this.closeButton.icon = this.scaledResource( ":/icons/close.png" );
   this.closeButton.onClick = function()
   {
      dialog.saveDialogSettings();
      dialog.cancel();
   };

   this.buttonSizer = new HorizontalSizer;
   this.buttonSizer.spacing = 6;
   this.buttonSizer.add( this.resetButton );
   this.buttonSizer.add( this.refreshButton );
   this.buttonSizer.addStretch();
   this.buttonSizer.add( this.selectAllButton );
   this.buttonSizer.add( this.unselectAllButton );
   this.buttonSizer.add( this.saveOverwriteButton );
   this.buttonSizer.add( this.applyButton );
   this.buttonSizer.add( this.closeButton );

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 8;
   this.sizer.add( this.infoLabel );
   this.sizer.add( this.mappingSizer );
   this.sizer.add( this.optionsHeaderLabel );
   this.sizer.add( this.modeSizer );
   this.sizer.add( this.suffixSizer );
   this.sizer.add( this.saveCheckBox );
   this.sizer.add( this.folderSizer );
   this.sizer.add( this.postSaveSizer );
   this.sizer.add( this.previewSizer, 100 );
   this.sizer.add( this.buttonSizer );

   this.adjustToContents();
   this.setMinWidth( 760 );

   this.fillMappingTree();
   this.refreshPreview();
   this.updateApplyState();
   this.updateSaveOptionVisibility();
}

ImageRenameByFilterDialog.prototype = new Dialog;

function main()
{
   if ( ImageWindow.windows.length == 0 )
   {
      (new MessageBox( "Open at least one image window before running this script.",
                       TITLE, StdIcon_Error, StdButton_Ok )).execute();
      return;
   }

   var dialog = new ImageRenameByFilterDialog;
   dialog.execute();
}

main();
