/*
 ***** BEGIN LICENSE BLOCK *****
 * This file is part of the application JunQuilla by Mesquilla.
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

// security overlay. Unfortunately there are not adequate ids, so instead we have
// to move our xul to the correct location dynamically.

(function()
{
  // global scope variables
  this.junquillaSecurityOverlay = {};

  // local shorthand for the global reference
  let self = this.junquillaSecurityOverlay;

  // module-level variables
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  const Cu = Components.utils;

  const junquillaStrings = Cc["@mozilla.org/intl/stringbundle;1"]
                               .getService(Ci.nsIStringBundleService)
                               .createBundle("chrome://junquilla/locale/junquilla.properties");

  self.onLoad = function onLoad(e)
  { try {
    // For some reason, the initial values of these preferences is not getting
    //  set, but they are updating OK. So I will set them here.
    let rootprefs = Cc["@mozilla.org/preferences-service;1"]
                      .getService(Ci.nsIPrefService)
                      .getBranch("");

    let maxJunkTokens =
      rootprefs.getIntPref("mailnews.bayesian_spam_filter.junk_maxtokens");
    let maxJunkTokensElement = document.getElementById("junquilla.junk_max_tokens");
    maxJunkTokensElement.setAttribute("value", maxJunkTokens);

    let junkThreshold =
      rootprefs.getIntPref("mail.adaptivefilters.junk_threshold");
    let junkThresholdElement = document.getElementById("junquilla.junk_threshold");
    junkThresholdElement.setAttribute("value", junkThreshold);

    const nsIJunkMailPlugin =
      Cc["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
        .getService(Ci.nsIJunkMailPlugin);
    const kJunkTrait = nsIJunkMailPlugin.JUNK_TRAIT;
    const kGoodTrait = nsIJunkMailPlugin.GOOD_TRAIT;

    let msgCount = {};
    let nsIMsgCorpus = nsIJunkMailPlugin.QueryInterface(Ci.nsIMsgCorpus);
    let tokenCount = nsIMsgCorpus.corpusCounts(kJunkTrait, msgCount);
    let junkCount = msgCount.value;
    nsIMsgCorpus.corpusCounts(kGoodTrait, msgCount);
    let goodCount = msgCount.value;

    let grid = document.getElementById("junquillaCorpusGrid");
    let totalTokenCount = document.getElementById("junquilla.totalTokenCount");
    totalTokenCount.setAttribute("value", tokenCount);
    let goodMessagesTrained = document.getElementById("junquilla.goodMessagesTrained");
    goodMessagesTrained.setAttribute("value", goodCount);
    let junkMessagesTrained = document.getElementById("junquilla.junkMessagesTrained");
    junkMessagesTrained.setAttribute("value", junkCount);

    // In TB, we need to add this to the tabpanel that is the parent of manualMark
    // In SM, that is not needed, and the tabpanel is not found.
    let manualMarkElement = document.getElementById("manualMark");
    if (manualMarkElement)
    {
      let tabpanel = manualMarkElement.parentNode;
      tabpanel.appendChild(grid);
      grid.setAttribute("hidden", "false");
    }
  } catch (e) {Cu.reportError(e);}};

})();

// TB startup, harmless on SM
window.addEventListener("paneload",
  function(event) {
    if(event.target.getAttribute("id") == 'paneSecurity')
      junquillaSecurityOverlay.onLoad(event);
  },
  false);

// SM startup
function Startup()
{
  junquillaSecurityOverlay.onLoad();
}
