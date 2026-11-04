// Copyright (c) 2026 Ian Steane. All rights reserved.
// Public visibility is for PixInsight update distribution only.

#feature-id    CloseWeightedWindows : Chapel Astro Utilities > Close Weighted Windows
#feature-info  Immediately close image windows with _weights in their title, ignoring case and discarding unsaved changes.

function closeWeightedWindows()
{
   // Snapshot the list because closing windows changes ImageWindow.windows.
   var windows = ImageWindow.windows.slice( 0 );
   for ( var i = 0; i < windows.length; ++i )
   {
      var window = windows[i];
      var title = window.mainView.id;
      if ( typeof window.caption == "string" )
         title += " " + window.caption;
      // The title also displays the file name. Do not match parent folders.
      if ( typeof window.filePath == "string" )
         title += " " + window.filePath.replace( /^.*[\\\/]/, "" );
      if ( /_weights/i.test( title ) )
         window.forceClose();
   }
}

closeWeightedWindows();
