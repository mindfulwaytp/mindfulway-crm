/**
 * Mindful Way CRM — Google Sheets Intake Script
 *
 * HOW TO USE:
 *   1. Open the Google Sheet linked to your intake Google Form.
 *   2. Click Extensions > Apps Script.
 *   3. Delete any existing code and paste this entire file.
 *   4. Fill in CLOUD_FUNCTION_URL and INTAKE_TOKEN below.
 *   5. Save the script (Ctrl+S / Cmd+S).
 *   6. Set up the trigger:
 *        - Click "Triggers" (clock icon on the left sidebar)
 *        - Click "+ Add Trigger"
 *        - Function: onFormSubmit
 *        - Event source: From spreadsheet
 *        - Event type: On form submit
 *        - Click Save (you'll be asked to authorize — approve it)
 *
 * INTAKE_TOKEN must match the INTAKE_TOKEN secret set in your Firebase project:
 *   firebase functions:secrets:set INTAKE_TOKEN
 */

var CLOUD_FUNCTION_URL = 'YOUR_SHEET_INTAKE_FUNCTION_URL_HERE';
var INTAKE_TOKEN = 'YOUR_SECRET_TOKEN_HERE';

function onFormSubmit(e) {
  var sheet = e.range.getSheet();
  var lastCol = sheet.getLastColumn();

  // Read header row
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // e.values is the submitted row in column order
  var values = e.values;

  // Build a header → value map
  var row = {};
  for (var i = 0; i < headers.length; i++) {
    var header = (headers[i] || '').toString().trim();
    var value  = (values[i]   || '').toString().trim();
    if (header) row[header] = value;
  }

  // ── Map Google Form column headers → CRM field names ──────────────────────
  // These header strings must exactly match the question titles in your Form.
  var payload = {
    responseId:        'gs_' + new Date().getTime(),
    submittedAt:       new Date().toISOString(),

    // Section 1 — Client Information
    clientName:        row['Full name']                                          || '',
    preferredName:     row['Preferred name (if different)']                      || '',
    dob:               row['Date of birth']                                      || '',
    parentGuardianName: row['Parent/guardian name (if client is a minor)']       || '',
    phone:             row['Phone number']                                        || '',
    email:             row['Email address']                                      || '',
    referralSource:    row['How did you hear about us?']                         || '',

    // Section 2 — Insurance
    insurance:         row['Insurance provider']                                 || '',
    memberId:          row['Member ID']                                          || '',

    // Section 3 — Services & Presenting Concerns
    servicesRequested: row['Services requested']                                 || '',
    problemChecklist:  row['Presenting concerns']                                || '',
    promptedYou:       row['What prompted you to seek therapy?']                 || '',

    // Section 4 — History & Safety
    previousTherapy:   row['Have you been in therapy before?']                   || '',
    previousMeds:      row['Have you previously taken psychiatric medication?']  || '',
    safety:            row['Are there any current safety concerns we should know about?'] || '',

    // Section 5 — Availability & Preferences
    days:              row['Available days']                                     || '',
    times:             row['Available times']                                    || '',
    ipTele:            row['Session format preference']                          || '',
    openToIntern:      row['Open to working with an intern therapist?']          || '',
    preferredProvider: row['Do you have a preferred provider? If so, who?']      || '',
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-intake-token': INTAKE_TOKEN,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(CLOUD_FUNCTION_URL, options);
    var code = response.getResponseCode();
    var body = response.getContentText();
    Logger.log('SHEET_INTAKE status=' + code + ' body=' + body);

    if (code !== 200) {
      // Write the error into column A of a "Errors" sheet if it exists
      logError('HTTP ' + code + ': ' + body, payload.clientName);
    }
  } catch (err) {
    Logger.log('SHEET_INTAKE_ERROR ' + err.toString());
    logError(err.toString(), payload.clientName);
  }
}

function logError(message, clientName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var errSheet = ss.getSheetByName('Errors');
    if (errSheet) {
      errSheet.appendRow([new Date(), clientName, message]);
    }
  } catch (e) {
    // Silently ignore if Errors sheet doesn't exist
  }
}
