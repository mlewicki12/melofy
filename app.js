
var express = require('express');
var mysql = require('mysql')
var fs = require('fs');

// reads the .config file in the current directory
// returns an array with up to two elements
// -- array[0] is the login in the config
// -- array[1] is the password in the config
function readConfig() {
  var contents = fs.readFileSync('.config', 'utf8');
  var list = contents.split("\n");
  
  var ret = ["", "", "", ""] // dummy array
  
  list.forEach(function(element) {
    var el = -1;
    if(element.startsWith("host")) {
      el = 0;
    }

    if(element.startsWith("user")) {
      el = 1;
    }
  
    if(element.startsWith("password")) {
      el = 2;
    }

    if(element.startsWith("database")) {
      el = 3;
    }

    if(el != -1) {
      ret[el] = element.split(":")[1];
    }

  });
  
  return ret;
}

var app = express();
  app.use(express.static("./public"));

var db = readConfig();
var con = mysql.createConnection({
  host: db[0],
  user: db[1],
  password: db[2],
  database: db[3]
});

con.connect(function(err) {
  if(err) {
    console.log("Error connecting to database\nPrinting below:\n\t" + err);
  } else console.log("Database successfully connected");
});

app.listen(8080, function() {
  console.log("Started listening on port 8080");
});
