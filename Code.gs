/**
 * Define Script property Id = your calendar Id
 * Then define trigger to run ProcessInvites in intervals
 */
var doEmail = false;
/**
 * Workaround to [Issue 5323](https://code.google.com/p/google-apps-script-issues/issues/detail?id=5323)
 * statusFilters parameter is not working; returns 0 events.
 * @param {string|array} status - GuestStatus or array of GuestStatus to match
 * @returns {function} - Callback parameter to Array.prototype.filter
 */
function statusFilters(status) {
  if (status instanceof Array) {
    return function(invite) {
      return status.includes(invite.getMyStatus());
    }
  } else {
    return function(invite) {
      return invite.getMyStatus() === status;
    }
  }
}

/**
 * Import an HTML template from file
 * @param {string} file - File to import
 * @param {boolean} [template=false] - If true, evaluate imported file as a template
 * @returns {HtmlOutput} Inline, rendered content
 */
function importTemplate(file, template) {
  if (template) {
    return HtmlService.createTemplateFromFile(file).evaluate().getContent();
  } else {
    return HtmlService.createHtmlOutputFromFile(file).getContent();
  }
}

function ProcessInvites() {
  var calendarId = PropertiesService.getScriptProperties().getProperty('Id');
  var calendar = CalendarApp.getCalendarById(calendarId);

  // Auto-accept any invite between now and one week from now.
  var start = new Date();
  var end = new Date(start.getTime() + (1000 * 60 * 60 * 24 * 7));

  var invites = calendar.getEvents(start, end).filter(statusFilters(CalendarApp.GuestStatus.INVITED));

  //Check for conflicts
  for (var i = 0, l = invites.length; i < l; i++) {
    var conflicts = calendar.getEvents(invites[i].getStartTime(), invites[i].getEndTime())
      .filter(statusFilters(CalendarApp.GuestStatus.YES));
    for (var ci = 0, cl = conflicts.length; ci < cl; ci++) {
      Logger.log("Found a potential conflict to: " + invites[i].getTitle());
      Logger.log("Creator is: " + invites[i].getCreators());
      var conflict = {
        "invite.creators": invites[i].getCreators(),
        "invite.title": invites[i].getTitle(),
        "conflict.start": Utilities.formatDate(conflicts[ci].getStartTime(), "GMT", "HH:mm"),
        "conflict.end": Utilities.formatDate(conflicts[ci].getEndTime(), "GMT", "HH:mm"),
        "conflict.title": conflicts[ci].getTitle(),
        "conflict.creators": conflicts[ci].getCreators()
      };
      var body = importTemplate('AutoResponse').replace(/{{([a-zA-Z\.]+)}}/g, function(match, p1, offset, string) {
        return conflict[p1];
      });
      if (doEmail) {
        GmailApp.sendEmail( calendarId,
          "[Invite conflict] " + invites[i].getTitle(), "",
          { htmlBody: body });
      }
    }

    if (conflicts.length === 0) {
      Logger.log("No conflict, accepting: " + invites[i].getTitle());
      invites[i].setMyStatus(CalendarApp.GuestStatus.YES);
    }
  }
}
