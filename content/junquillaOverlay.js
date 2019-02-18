/*
 ***** BEGIN LICENSE BLOCK *****
 * This file is part of Junquilla, Junk mail management by Mesquilla.
 *
 * Junquilla is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * You should have received a copy of the GNU General Public License
 * along with Junquilla.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Junquilla code.
 *
 * The Initial Developer of the Original Code is
 * Kent James <rkent@mesquilla.com>
 * Portions created by the Initial Developer are Copyright (C) 2008, 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK *****
 */

(function()
{
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  const Cu = Components.utils;

  // global scope variables
  if (!this.junquillaOverlay)
    this.junquillaOverlay = {};

  // local shorthand for the global reference
  let that = this.junquillaOverlay;

  that.columnHandlerJunkPercent = {
     getCellText:         function(row, col) {
        // get the message's header so that we can extract the field
        let key = gDBView.getKeyAt(row);
        let hdr = gDBView.getFolderForViewIndex(row).GetMessageHeader(key);
        return hdr.getStringProperty("junkpercent");
     },
     getSortStringForRow: function(hdr) {
         return null;},
     isString:            function() {return false;}, // will sort using integers
     getCellProperties:   function(row, col, props){},
     getImageSrc:         function(row, col) {return null;},
     getSortLongForRow:   function(hdr) {
       // sort nulls first, by adding 1 to the value
       if (hdr.getStringProperty("junkpercent") == null) {return 0;}
       return 1 + parseInt(hdr.getStringProperty("junkpercent"));
     },
     getRowProperties:    function(index, properties) {return null;}
  };

  that.columnHandlerJunkStatusPlus = {
    getCellText:         function(row, col) {
      return null;
    },
    getSortStringForRow: function(hdr) {
      let prefix = "G"; // good
      let junkscore = hdr.getStringProperty("junkscore");
      if (junkscore == "100")
        prefix = "S";
      let junkscoreorigin = hdr.getStringProperty("junkscoreorigin");
      return prefix + junkscoreorigin;
    },
    isString:            function() {return true;},
    getCellProperties:   function(row, col, props){},
    getImageSrc:         function(row, col) {
      let key = gDBView.getKeyAt(row);
      let hdr = gDBView.getFolderForViewIndex(row).GetMessageHeader(key);
      let junkscore = hdr.getStringProperty("junkscore");
      let isHam;
      switch (parseInt(junkscore)) {
        case Ci.nsIJunkMailPlugin.IS_SPAM_SCORE:
          isHam = false;
          break;
        case Ci.nsIJunkMailPlugin.IS_HAM_SCORE:
          isHam = true;
          break;
        default:
          return "chrome://junquilla/skin/unclassified.png";
      }

      switch (hdr.getStringProperty("junkscoreorigin")) {
        case "user":
          if (isHam)
            return "chrome://junquilla/skin/gooduser.png";
          return "chrome://junquilla/skin/junkuser.png";
        case "plugin":
          if (isHam)
            return "chrome://junquilla/skin/goodbayes.png";
          return "chrome://junquilla/skin/junkbayes.png";
        case "whitelist":
          if (isHam)
            return "chrome://junquilla/skin/goodwhite.png";
          return "chrome://junquilla/skin/junkwhite.png";
        case "filter":
          if (isHam)
            return "chrome://junquilla/skin/goodfilter.png";
          return "chrome://junquilla/skin/junkfilter.png";
        case "imapflag":
          if (isHam)
            return "chrome://junquilla/skin/goodflag.png";
          return "chrome://junquilla/skin/junkflag.png";
        default:
          if (isHam)
            return "chrome://junquilla/skin/good.png";
          return "chrome://junquilla/skin/junk.png";
      }
    },
    getSortLongForRow:   function(hdr) { return null;},
    getRowProperties:    function(index, properties) {return null;},
    cycleCell:           function(row, col)
    {
      let junkColumn = col.columns.getNamedColumn("junkStatusCol");
      let dBView = gDBView.QueryInterface(Ci.nsITreeView);
      dBView.cycleCell(row, junkColumn);
    }
  };

  that.addCustomColumnHandler = function() {

     {
       if (gDBView)
       {
         gDBView.addColumnHandler("colJunkPercent", that.columnHandlerJunkPercent);
         gDBView.addColumnHandler("colJunkStatusPlus", that.columnHandlerJunkStatusPlus);
       }
     }
  };

  // Make sure that the training data is saved, in case there are leaks
  //  that prevent normal C++ destructor.
  that.onQuit = {
    observe: function JunquillaObserveOnQuit(aSubject, aTopic, aData) {
      let nsIJunkMailPlugin = Cc["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
                                .getService(Ci.nsIJunkMailPlugin);
      nsIJunkMailPlugin.shutdown();
    }
  };

  that.doOnceLoaded = function () {
    //dump("\ndoOnceLoaded ");
    let ObserverService = Cc["@mozilla.org/observer-service;1"]
                             .getService(Ci.nsIObserverService);
    // shutdown observer to make sure that training gets saved
    ObserverService.addObserver(that.onQuit, "quit-application", false);
    // custom columns
    ObserverService.addObserver(that.CreateDbObserver, "MsgCreateDBView", false);
    that.CreateDbObserver.observe(msgWindow.openFolder, null, null);
    that.CreateDbObserver.observe(msgWindow.openFolder, null, null);

    // folder pane overrides
    try { // this will fail for SeaMonkey
      that.overrideFolderProperties();
    } catch (e) {};

    // strings
    that.strings = document.getElementById("junquilla-strings");

    // When first installed, we'll add the uncertain folders, and adjust parameters
    let rootPrefs = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefService)
                        .getBranch("");
    let installed = false;
    try {
      installed = rootPrefs.getBoolPref("extensions.junquilla.installed");
    } catch (e) {}

    if (!installed)
    {
      rootPrefs.setBoolPref("extensions.junquilla.installed", true);

      // add the Uncertain folders
      junquilla.addUncertain();

      // Increase the limits of tokens
      if (!rootPrefs.prefHasUserValue("mailnews.bayesian_spam_filter.junk_maxtokens"))
        rootPrefs.setIntPref("mailnews.bayesian_spam_filter.junk_maxtokens", 300000);

      // disable marking as unread after training as not junk
      rootPrefs.setBoolPref("mail.spam.markAsNotJunkMarksUnRead", false);

      // don't tokenize date headers
      rootPrefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.date",
                                    "false");
      rootPrefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.delivery-date",
                                    "false");

      // don't tokenize message-id
      rootPrefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.message-id",
                                    "false");

      // don't tokenize mozilla headers, which are set locally.
      rootPrefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.x-mozilla-status",
                                    "false");
      rootPrefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.x-mozilla-status2",
                                    "false");
      rootPrefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.x-mozilla-keys",
                                    "false");
      rootPrefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.x-uidl",
                                    "false");
    }

  };

  that.overrideFolderProperties = function() {
    if (ftvItem.prototype.preJunquillaGetProperties) // already inited?
      return;
    ftvItem.prototype.preJunquillaGetProperties = ftvItem.prototype.getProperties;
    ftvItem.prototype.getProperties = function(aProps) {
      let properties = this.preJunquillaGetProperties(aProps);
      try {
        if (this._folder.getStringProperty("Junquilla.UncertainFolder") == "true")
        {
          let numMessages = this._folder.getTotalMessages(false);
          if (typeof (properties) == "string")
          { // Post Moz21
            properties += " junquillaUncertain";
            if (numMessages > 0)
              properties += " hasMessages-true";
            else
              properties += " hasMessages-false";
          }
          else
          {
            let atomSvc = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
            aProps.AppendElement(atomSvc.getAtom("junquillaUncertain"));
            if (numMessages > 0)
              aProps.AppendElement(atomSvc.getAtom("hasMessages-true"));
            else
              aProps.AppendElement(atomSvc.getAtom("hasMessages-false"));
          }
        }
      }
      catch (e) {} // servers for example fail
      finally {return properties;}
    }
    ftvItem.prototype.preJunquillaGetText = ftvItem.prototype.__lookupGetter__("text");
    //dump("\nIn text getter ");
    ftvItem.prototype.__defineGetter__("text",
      function () {
        let text = this.preJunquillaGetText();
        try {
          if (this._folder.getStringProperty("Junquilla.UncertainFolder") == "true")
          {
            text = this._folder.abbreviatedName;
            if (this.useServerName)
              text += " - " + this._folder.server.prettyName;

            let numMessages = this._folder.getTotalMessages(false);
            let numUnreadMessages = this._folder.getNumUnread(false);
            if (numMessages > 0)
              text += " (" + numUnreadMessages + "/" + numMessages + ")";
          }
        }
        catch (e) {} // servers fail for example, so fail silently
        return text;
      } );
  };

  that.CreateDbObserver = {
    // Ci.nsIObserver
    observe: function(aMsgFolder, aTopic, aData)
    {
       if (!aMsgFolder)
         return;
       that.addCustomColumnHandler();

       // This next section removes junk columns from news views.
       let colJunkPercent = document.getElementById("colJunkPercent");
       let colJunkStatusPlus = document.getElementById("colJunkStatusPlus");
       let saveHidden;
/*
       if (isNewsURI(aMsgFolder.URI) && ("false" == colJunkPercent.getAttribute("lastnews") ) )
       {
         saveHidden = colJunkStatusPlus.getAttribute("hidden");
         colJunkStatusPlus.setAttribute("hidden", true);
         colJunkStatusPlus.setAttribute("swappedhidden", saveHidden);
         saveHidden = colJunkPercent.getAttribute("hidden");
         colJunkPercent.setAttribute("hidden", true);
         colJunkPercent.setAttribute("swappedhidden", saveHidden);
         colJunkPercent.setAttribute("lastnews", "true");
       }
       else if (!isNewsURI(aMsgFolder.URI) && ("false" != colJunkPercent.getAttribute("lastnews") ) )
       {
         colJunkStatusPlus.setAttribute("hidden", colJunkStatusPlus.getAttribute("swappedhidden"));
         colJunkPercent.setAttribute("hidden", colJunkPercent.getAttribute("swappedhidden"));
         colJunkPercent.setAttribute("lastnews", "false");
       }
/**/
    }
  };

  // main Token Manager class constructor
  that.setupWindowOpen = function() {

     that.setupWindow=window.open("chrome://junquilla/content/junquillaSetupWindow.xul", "_blank",
          "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
  };

})();

window.addEventListener("load", junquillaOverlay.doOnceLoaded, false);
