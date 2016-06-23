const fs = require('fs'),
      readline = require('readline'),
      google = require('googleapis'),
      googleAuth = require('google-auth-library'),
      ical = require('ical');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/calendar-nodejs-quickstart.json
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = 'calendar-token.json';

const EVENT_URL = 'https://a.wunderlist.com/api/v1/ical/6394394-7pk65a6rrjo4mpr89tn5flf7i5.ics';
const calendarId = 'o19ecvhtav921g8ct383sfh4ec@group.calendar.google.com';
const timeZone = 'Asia/Novosibirsk'; // Formatted as an IANA Time Zone Database name, e.g. "Europe/Zurich".
const timer = 1000*60*60; // 1 hour

var events_list = {};

sync();
setInterval(function() {
  sync();
}, timer);

function sync() {
  // Load client secrets from a local file.
  fs.readFile('client_secret.json', function processClientSecrets(err, content) {
    if (err) {
      console.log('Error loading client secret file: ' + err);
      return;
    }
    
    ical.fromURL(EVENT_URL, {}, function(err, data) {
      if (err) {
        console.log('Error loading events from url: ' + err);
        return;
      }

      events_list = data;

      authorize(JSON.parse(content), syncEvents);
    });
  });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Sync events
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function syncEvents(auth) {
  var calendar = google.calendar('v3');

  calendar.events.list({
    auth: auth,
    calendarId: calendarId,
    singleEvents: true,
    orderBy: 'startTime'
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }

    var events = response.items;
    if (events.length == 0) {
      console.log('No upcoming events found.');
    } else {
      for (var i = 0; i < events.length; i++) {
        var event = events[i];
        var start = event.start.dateTime || event.start.date;
        console.log('%s - %s', start, event.summary);

        calendar.events.delete({
          auth: auth,
          calendarId: calendarId,
          eventId: event.id
        })
      }
    }

    var keys = Object.keys(events_list);

    for (var i = keys.length - 1; i >= 0; i--) {
      var w_event = events_list[keys[i]];

      var date = new Date(w_event.start);

      var event = {
        'summary': w_event.summary,
        'description': w_event.description,
        'start': {
          'dateTime': date,
          'timeZone': timeZone,
        },
        'end': {
          'dateTime': date,
          'timeZone': timeZone,
        }
      };

      newEvent(auth, event);
    }
  });
}

function newEvent(auth, event) {
  var calendar = google.calendar('v3');

  calendar.events.insert({
    auth: auth,
    calendarId: calendarId,
    resource: event,
  }, function(err, event) {
    if (err) {
      console.log('There was an error contacting the Calendar service: ' + err);
      return;
    }
    console.log('Event created: %s', event.htmlLink);
  });
}