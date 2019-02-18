/*
 ***** BEGIN LICENSE BLOCK *****
 * This file is part of an application by Mesquilla.
 *
 * This application is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * You should have received a copy of the GNU General Public License
 * along with this application.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mesquilla code.
 *
 * The Initial Developer of the Original Code is
 * Kent James <rkent@mesquilla.com>
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK *****
 */
 
 // folder properties overlay. Unfortunately there are not adequate ids in the
 // filter properties xul to make a normal overlay possible, so instead we have
 // to add our xul dynamically.

Components.utils.import("resource://junquilla/inheritedPropertiesGrid.jsm");
 
(function()
{
  // global scope variables
  this.junquillaFolderProps = {};

  // local shorthand for the global reference
  let self = this.junquillaFolderProps;

  // module-level variables
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  const Cu = Components.utils;

  let folder; // nsIMsgFolder passed to the window

  self.onLoad = function onLoad(e)
  { try {
    folder = window.arguments[0].folder;

    window.gInheritTarget = folder;
    // create or get the rows from the inherit grid
    let rows = InheritedPropertiesGrid.getInheritRows(document);
    let row = InheritedPropertiesGrid.createInheritRow("dobayes.mailnews@mozilla.org#junk", folder, document);
    if (row)  // false means another extension is handling this, so quit
    {
      rows.appendChild(row);
      // extend the ondialogaccept attribute
      let dialog = document.getElementsByTagName("dialog")[0];
      dialog.setAttribute("ondialogaccept", "junquillaFolderProps.onAcceptInherit();" + 
                          dialog.getAttribute("ondialogaccept"));
    }
  } catch (e) {Cu.reportError(e);}};

  self.onAcceptInherit = function junquillaDoBayesOnAcceptInherit()
  { try {
    InheritedPropertiesGrid.onAcceptInherit("dobayes.mailnews@mozilla.org#junk", folder, document);
  } catch (e) {Cu.reportError(e);}}

})();

window.addEventListener("load", function(e) { junquillaFolderProps.onLoad(e); }, false);
