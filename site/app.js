
var express = require('express');
var mysql = require('mysql')
var fs = require('fs');
var queryString = require('querystring');
var cors = require('cors');
var cookieParser = require('cookie-parser');

var spotify = require('./spotify');

// reads the .config file in the current directory
// returns an array with up to two elements
// -- array[0] is the login in the config
// -- array[1] is the password in the config
function readConfig() {
  var contents = fs.readFileSync('.config', 'utf8');
  var list = contents.split('\n');
  
  var ret = ['', '', '', ''] // dummy array
  
  list.forEach(function(element) {
    var el = -1;
    if(element.startsWith('host')) {
      el = 0;
    }

    if(element.startsWith('user')) {
      el = 1;
    }
  
    if(element.startsWith('password')) {
      el = 2;
    }

    if(element.startsWith('database')) {
      el = 3;
    }

    if(el != -1) {
      ret[el] = element.split(':')[1].trim();
    }

  });
  
  return ret;
}

var app = express().use(express.static('./public'))
		   .use(cors())
		   .use(cookieParser());

var db = readConfig();
var con = mysql.createConnection({
  host: db[0],
  user: db[1],
  password: db[2],
  database: db[3]
});

con.connect(function(err) {
  if(err) {
    console.log('Error connecting to database\n' + err);
  } else {
    console.log('Database successfully connected');
    con.query('SELECT * FROM playlists', function(err, row, fields) {
      if(err && err.code == 'ER_NO_SUCH_TABLE') {
        var query = fs.readFileSync('create.sql', 'utf8');
	con.query(query, function(er, ro, field) {
	  if(er) {
	    console.log('Error applying create script!\n' + er);
	  } else console.log('Successfully applied create script to database');
	});
      } else {
	console.log('playlists already exists, printing below');
	console.log(row);
      }
    });
  }
});

var stateKey = 'spotify_auth_state';
spotify.init('http://localhost:8080/callback');

/*
 * Login to Spotify
 */
app.get('/login', function(req, res) {
	spotify.auth('user-read-private user-read-birthdate playlist-modify-public playlist-modify-private', function(link, state) {
		console.log(link);
		res.cookie(stateKey, state);
		res.redirect(link);
	});
});

/*
 * Spotify callback info
 * Not used in this project
 */
app.get('/callback', function(req, res) {
	var code 	= req.query.code  || null;
	var state	= req.query.state || null;
	var storedState = req.cookies ? req.cookies[stateKey] : null;

	if(state === null || state !== storedState) {
		console.log('state mismatch error\n' + state + ' : ' + storedState);
		res.redirect('/#' +
			queryString.stringify({
				error: 'state-mismatch'
			}));
	} else {
		spotify.request(code, function(acc, ref) {
			console.log('received access token ' + acc);
			console.log('received refresh token ' + ref);
			res.redirect('/#' +
				queryString.stringify({
					access_token: acc,
					refresh_token: ref
				}));
		});
	}

});

/*
 * Get a set of recommendations
 *
 * URL paraments
 * @param  {string} variance Unused right now, modify between target_ and max_min values
 * @param  {string} tracks   A comma separated list of tracks
 * @param  {string} limit    Amount of tracks to search for, between 1 to 100
 * @param  {string} market   Destination market country code
 * @param  {string} target_* Attribute values, between 0 to 1
 * @return {json}   The list of recommendations
 */
app.get('/recommendations', function(req, res) {
	// not doing anything with this atm
	// ideally, instead of target_*, it'd become max_* + variance, min_* + variance
	var variance = req.query.variance || 0.15;

	// not sure how to create an object in js, lol
	var attr = {
		limit: 20
	};

	// still need to read through artists, tracks, and genres to ensure only five at a time are sent
	var tracks = [];
	if(req.query.tracks) {
		tracks = req.query.tracks.split(',');
		console.log(tracks);
	}

	// check if each value exists in the query
	var keys = ['limit', 'market', 'target_acousticness', 'target_danceability', 
		    'target_duration_ms', 'target_energy', 'target_instrumentalness', 
		    'target_key', 'target_liveness', 'target_loudness', 'target_mode', 
		    'target_popularity', 'target_speechiness', 'target_tempo', 
		    'target_valence'];

	keys.forEach( function(element) {
		if(req.query[element]) {
			console.log('found ' + element + '=' + req.query[element] + ', adding to attr');
			attr[element] = req.query[element];
		}
	});

	console.log(queryString.stringify(attr));
});

/*
 * Search for a song given a query
 *
 * @param  {string} query The query to search for, spaces formatted to %20
 * @return {json}   The returned list of tracks
 */
app.get('/search', function(req, res) {
	spotify.search(req.query.query, function(items) {
		res.send(items);
	});
});


/*
 * Get the user's profile info
 *
 * @return {json} The user's profile
 */
app.get('/profile', function(req, res) {
	spotify.profile(function(body) {
		res.send(body);
	});
});

/*
 * Insert playlists into console
 *
 * @param {string} link Playlist link
 * @param {string} user User's id
 */
app.get('/insertplaylist', function(req, res) {
	var pLink = req.query.link;
	var userid = req.query.user;
	con.query("INSERT INTO playlists (link, userid) values ('" + pLink + "', '" + userid + "');");
	res.end();
	
});

/*
 * Get all playlists
 *
 * @return {html} The constructed html table
 */
app.get('/displayplaylist', function(req, res) {
	var table = "<table>";
	con.query('SELECT * from playlists' , function(err, rows, fields){
			table += "<tr><th>ID</th><th>User ID</th><th>Playlist</th></tr>";
			for (var i = 0; i < rows.length; i++){
				table += "<tr><td>" + rows[i].id + "</td><td>" + rows[i].userid + "</td><td>" + rows[i].link +  "</td></tr>";
			}
			table += "</table>";
			res.send(table);
			res.end();
	});
	
});

app.listen(8080, function() {
  console.log('Started listening on port 8080');
});
