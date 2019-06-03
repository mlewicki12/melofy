`use strict`

var fs 			= require('fs');
var queryString 	= require('queryString');
var cookieParser 	= require('cookie-parser');
var request		= require('request');

var data = fs.readFileSync('./.spotify', 'utf-8');
var res = data.split('\n');

var client_id = res[0];
var client_secret = res[1];

var redirect_uri = 'INVALID';

var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

/**
 * Used to initialize the module
 *
 * Sets the redirect_uri to the desired page
 * @param  {string} callback The desired redirect uri
 */
exports.init = function(callback) {
	redirect_uri = callback;
	console.log('set redirect page to ' + redirect_uri);
}

/**
 * First step to get Spotify auth
 * Called when users GET request /login
 *
 * Returns login page with requested scope
 * @param  {string}   scope    Request authorization from Spotify
 * @param  {function} callback The function to call when completed, takes link and state
 * @return {string}   The generated spotify authorize link
 */
exports.auth = function(scope, callback) { 
	console.log('requesting scope access: ' + scope);
	var state = generateRandomString(16);

	console.log(redirect_uri);
	callback('https://accounts.spotify.com/authorize?' +
		queryString.stringify({
			response_type: 'code',
			client_id: client_id,
			scope: scope,
			redirect_uri: redirect_uri,
			state: state
		}),
		state);
}

/**
 * Second step to get Spotify auth
 * Called after Spotify redirects to /callback
 *
 * Returns the access and refresh tokens in an array if successful
 * @param  {string}   code     Received code from Spotify
 * @param  {function} callback Callback function, takes the access and refresh tokens
 * @return {array} Access and Refresh tokens if successful, 'Error' and Error url if not
 */
exports.request = function(code, callback) {
	var authOptions = {
		url: 'https://accounts.spotify.com/api/token',
		form: {
			code: code,
			redirect_uri: redirect_uri,
			grant_type: 'authorization_code'
		},
		headers: {
			'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
		},
		json: true
	};

	console.log('sending post request to https://accounts.spotify.com/api/token');
	request.post(authOptions, function(error, response, body) {
		if (!error && response.statusCode === 200) {
			callback(body.access_token, body.refresh_token);
		} else {
			console.log('error: ' + error);
			callback(error, response.statusCode);
		}
	});
}
