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
 
Components.utils.import("resource://junquilla/inheritedPropertiesGrid.jsm");
Components.utils.import("resource:///modules/iteratorUtils.jsm");

(function()
{
  const Cc = Components.classes;
  const Ci = Components.interfaces;

  const junquillaStrings = Cc["@mozilla.org/intl/stringbundle;1"]
                             .getService(Ci.nsIStringBundleService)
                             .createBundle("chrome://junquilla/locale/junquilla.properties");

  // global scope variables
  if (!this.junquilla)
    this.junquilla = {};

  // local shorthand for the global reference
  let that = this.junquilla;

  that.addUncertain = function()
  {
    that.processUncertain(true);
  };

  that.processUncertain = function(doAdd)
  {
    let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                    .getService(Ci.nsIMsgAccountManager);
    let servers = acctMgr.allServers;
    let inbox, subfolderEnum;
    for (let server in fixIterator(servers, Ci.nsIMsgIncomingServer)) {
      try {
        inbox = server.rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox);
        subfolderEnum = inbox.subFolders;
      }
      catch (e) {continue;}
      let isUncertain = false;
      let folder;
      while (subfolderEnum && subfolderEnum.hasMoreElements())
      {
        folder = subfolderEnum.getNext()
                              .QueryInterface(Ci.nsIMsgFolder);
        isUncertain = ("true" == folder.getStringProperty("Junquilla.UncertainFolder"));
        if (isUncertain)
          break; // folder already exists
      }
      if (!isUncertain && doAdd) // add the folder
      {
        that.addJunkPercentFolder(junquillaStrings.GetStringFromName("uncertain"), inbox, 10, 90);
      }
      if (isUncertain && !doAdd) // remove the folder
      {
        let folderArray = Cc["@mozilla.org/array;1"]
                            .createInstance(Ci.nsIMutableArray);
        folderArray.appendElement(folder, false);
        inbox.deleteSubFolders(folderArray, null);
      }
    }
  };

  that.removeUncertain = function()
  {
    that.processUncertain(false);
  };

  that.addJunkPercentFolder = function(aNewName, aParentFolder, aLower, aUpper)
  {
    let searchTermLower = null;
    if (aLower > 0)
      searchTermLower = that.makeSearchTerm(aParentFolder,
          aLower - 1, Ci.nsMsgSearchAttrib.JunkPercent, Ci.nsMsgSearchOp.IsGreaterThan);

    let searchTermUpper = null;
    if (aUpper < 100)
      searchTermUpper = that.makeSearchTerm(aParentFolder,
          aUpper + 1, Ci.nsMsgSearchAttrib.JunkPercent, Ci.nsMsgSearchOp.IsLessThan);

    let searchSession = Cc["@mozilla.org/messenger/searchSession;1"]
                          .createInstance(Ci.nsIMsgSearchSession);
    searchSession.addScopeTerm(Ci.nsMsgSearchScope.offlineMail, aParentFolder);
    if (searchTermLower)
      searchSession.appendTerm(searchTermLower);
    if (searchTermUpper)
      searchSession.appendTerm(searchTermUpper);

    let folder = that.createVirtualFolder(aNewName, aParentFolder,
        aParentFolder.URI, searchSession.searchTerms, false);
    if (!folder)
      return; // for example, duplicate folder for Local Folders
    folder.setStringProperty("Junquilla.UncertainFolder", "true");
  };

  that.createVirtualFolder = function(newName, parentFolder, searchFolderURIs, searchTerms, searchOnline)
  {
    try {
      var newFolder = parentFolder.addSubfolder(newName);
    }
    catch (e) {return null;} // Silently fail if, for example, name already exists
    newFolder.prettyName = newName; // This also initializes the db as a side effect
    newFolder.setFlag(Ci.nsMsgFolderFlags.Virtual);
    let vfdb = newFolder.msgDatabase;
    let searchTermString = that.getSearchTermString(searchTerms);
    
    let dbFolderInfo = vfdb.dBFolderInfo;
    // set the view string as a property of the db folder info
    // set the original folder name as well.
    dbFolderInfo.setCharProperty("searchStr", searchTermString);
    dbFolderInfo.setCharProperty("searchFolderUri", searchFolderURIs);
    dbFolderInfo.setBooleanProperty("searchOnline", searchOnline);
    vfdb.summaryValid = true;
    vfdb.Commit(Ci.nsMsgDBCommitType.kLargeCommit);
    
    // use acctMgr to setup the virtual folder listener
    let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                    .getService(Ci.nsIMsgAccountManager);
    acctMgr = acctMgr.QueryInterface(Ci.nsIFolderListener);
    acctMgr.OnItemAdded(null, newFolder);
    parentFolder.NotifyItemAdded(newFolder);
    return newFolder;
  };

  that.getSearchTermString = function(searchTerms)
  {
    let condition = "";
    
    let count = searchTerms.Count();
    for (let searchIndex = 0; searchIndex < count; searchIndex++)
    {
      let term = searchTerms.QueryElementAt(searchIndex, Ci.nsIMsgSearchTerm);
      
      if (condition.length > 1)
        condition += ' ';
      
      if (term.matchAll)
      {
          condition = "ALL";
          break;
      }
      condition += (term.booleanAnd) ? "AND (" : "OR (";
      condition += term.termAsString + ')';
    }

    return condition;
  };

  // Create a search term for searching aFolder
  //   using aAttrib, aOp, and value aValue
  that.makeSearchTerm = function(aFolder, aValue, aAttrib, aOp)
  {
    // use a temporary search session
    let searchSession = Cc["@mozilla.org/messenger/searchSession;1"]
                          .createInstance(Ci.nsIMsgSearchSession);
    searchSession.addScopeTerm(Ci.nsMsgSearchScope.offlineMail, aFolder);
    let searchTerm = searchSession.createTerm();
    searchTerm.attrib = aAttrib;
    
    let value = searchTerm.value;
    // This is tricky - value.attrib must be set before actual values
    value.attrib = aAttrib;
    if (aAttrib == Ci.nsMsgSearchAttrib.JunkPercent)
      value.junkPercent = aValue;
    else if (aAttrib == Ci.nsMsgSearchAttrib.Priority)
      value.priority = aValue;
    else if (aAttrib == Ci.nsMsgSearchAttrib.Date)
      value.date = aValue;
    else if (aAttrib == Ci.nsMsgSearchAttrib.MsgStatus)
      value.status = aValue;
    else if (aAttrib == Ci.nsMsgSearchAttrib.MessageKey)
      value.msgKey = aValue;
    else if (aAttrib == Ci.nsMsgSearchAttrib.Size)
      value.size = aValue;
    else if (aAttrib == Ci.nsMsgSearchAttrib.AgeInDays)
      value.age = aValue;
    else if (aAttrib == Ci.nsMsgSearchAttrib.Size)
      value.size = aValue;
    else if (aAttrib == Ci.nsMsgSearchAttrib.Label)
      value.label = aValue;
    else if (aAttrib == Ci.nsMsgSearchAttrib.JunkStatus)
      value.junkStatus = aValue;
    else if (aAttrib == Ci.nsMsgSearchAttrib.HasAttachmentStatus)
      value.status = 0x10000000;  // 0x10000000 is MSG_FLAG_ATTACHMENT
    else
      value.str = aValue;
    searchTerm.value = value;
    searchTerm.op = aOp;
    searchTerm.booleanAnd = true;

    return searchTerm;
  };
  
  that.detailWindowOpen = function(aDBView)
  {
    try {
      that.detailWindow = window.openDialog("chrome://junquilla/content/detail.xul", "_blank",
          "chrome,extrachrome,menubar,resizable=yes,scrollbars=yes,status=yes",
          aDBView.hdrForFirstSelectedMessage);
    }
    catch (e) {} // fails normally if nothing selected
  };
  that.detailWindowLoad = function()
  {
    var labelSubject = document.getElementById("junquillaDetailMessage");
    var hdr = window.arguments[0];
    labelSubject.setAttribute("value", hdr.mime2DecodedSubject);
    that.requestDetail(hdr);
  };
  
  that.detailWindowUnload = function()
  {
  };

  that.requestDetail = function(hdr)
  {
    var messageURI = hdr.folder.generateMessageURI(hdr.messageKey) + "?fetchCompleteMessage=true";
    const nsIJunkMailPlugin = Cc["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
                                .getService(Ci.nsIJunkMailPlugin);
    nsIJunkMailPlugin.detailMessage(messageURI, nsIJunkMailPlugin.JUNK_TRAIT,
        nsIJunkMailPlugin.GOOD_TRAIT, that.detailListener);
  };
  
  that.detailListener = 
  {
    onMessageTraitDetails: function(aMsgURI, aProTrait, aTokenCount,
      aTokenStrings, aTokenPercents, aRunningPercents)
    {
      // add the data to the detail tree
      var detailChildren = document.getElementById("junquillaDetailChildren");
      for (var i = 0; i < aTokenCount; i++)
      {
        let treeItem = document.createElement("treeitem");
        let treeRow = document.createElement("treerow");
        detailChildren.appendChild(treeItem);
        treeItem.appendChild(treeRow);
        let stringCell = document.createElement("treecell");
        let tokenCell = document.createElement("treecell");
        let runningCell = document.createElement("treecell");
        stringCell.setAttribute("label", aTokenStrings[i]);
        tokenCell.setAttribute("label", aTokenPercents[i]);
        runningCell.setAttribute("label", aRunningPercents[i]);
        treeRow.appendChild(stringCell);
        treeRow.appendChild(tokenCell);
        treeRow.appendChild(runningCell);
      }
    }
  };

  // Inherited folder property to disable/enable junk processing for folders.
  let dobayes = {
    defaultValue: function defaultValue(aFolder) {
      /*
       * implement this check from nsMsgDBFolder.cpp:
       *
       *     if (serverType.EqualsLiteral("rss") ||
       *  (mFlags & (nsMsgFolderFlags::Junk | nsMsgFolderFlags::Trash |
       *             nsMsgFolderFlags::SentMail | nsMsgFolderFlags::Queue |
       *             nsMsgFolderFlags::Drafts | nsMsgFolderFlags::Templates |
       *             nsMsgFolderFlags::ImapPublic | nsMsgFolderFlags::Newsgroup |
       *             nsMsgFolderFlags::ImapOtherUser) &&
       *   !(mFlags & nsMsgFolderFlags::Inbox)))
       *  filterForJunk = PR_FALSE;
       */
      // aFolder can be either an nsIMsgIncomingServer or an nsIMsgFolder
      let server;
      let mFlags = 0;
      if (aFolder instanceof Ci.nsIMsgIncomingServer)
        server = aFolder
      else {
        mFlags = aFolder.flags;
        server = aFolder.server;
      }

      let nsMsgFolderFlags = Ci.nsMsgFolderFlags;
      if ( (server.type == "rss") || (server.type == "nntp") ||
           (mFlags & (nsMsgFolderFlags.Junk | nsMsgFolderFlags.Trash |
                      nsMsgFolderFlags.SentMail | nsMsgFolderFlags.Queue |
                      nsMsgFolderFlags.Drafts | nsMsgFolderFlags.Templates |
                      nsMsgFolderFlags.ImapPublic | nsMsgFolderFlags.Newsgroup |
                      nsMsgFolderFlags.ImapOtherUser) &&
           !(mFlags & nsMsgFolderFlags.Inbox)))
        return false;
      return true;
    },
    name: junquillaStrings.GetStringFromName("analyzeJunk"),
    accesskey: junquillaStrings.GetStringFromName("analyzeJunk.accesskey"),
    property: "dobayes.mailnews@mozilla.org#junk",
    hidefor: "none,pop3,nntp,rss,imap" // This is disabled in the account manager because of bug 525024
  };
  
  InheritedPropertiesGrid.addPropertyObject(dobayes);

})();
