
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

app.get('/login', function(req, res) {
	spotify.auth('playlist-modify-public playlist-modify-private', function(link, state) {
		console.log(link);
		res.cookie(stateKey, state);
		res.redirect(link);
	});
});

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

app.get('/recommendations', function(req, res) {
	// not doing anything with this atm
	// ideally, instead of target_*, it'd become max_* + variance, min_* + variance
	var variance = req.query.variance || 0.15;

	// not sure how to create an object in js, lol
	var attr = {
		limit: 20
	};

	// still need to read through artists, tracks, and genres to ensure only five at a time are sent
	var artists = [];
	if(req.query.artists) {
		artists = req.query.artists.split(',');
		console.log(artists);
	}

	var tracks = [];
	if(req.query.tracks) {
		tracks = req.query.tracks.split(',');
		console.log(tracks);
	}
	
	var genres = [];
	if(req.query.genres) {
		genres = req.query.genres.split(',');
		console.log(genres);
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

//Use this endpoint to insert values into the playlists database
//Url variables are pLink for playlist link and userid
//No quotes around strings in url
app.get('/insertplaylist', function(req, res) {
	var pLink = req.query.pLink;
	var userid = req.query.userid;
	con.query("INSERT INTO playlists (link, userid) values ('" + pLink + "', '" + userid + "');");
	res.end();
	
});

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
