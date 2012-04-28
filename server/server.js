
// **************************************************************

var auth = require('./src/auth.js')
  , data = require('./src/data.js')
  , db   = require('./src/db.js')
  , user = require('./src/user.js')
  , chat = require('./src/chat.js')
  , play = require('./src/play.js')
  , render = require('./src/render.js')
  , util = require('./src/util.js');

var express = require('express')
  , path = require('path');

var app = express.createServer();

app.configure(function(){
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(express.session({secret: util.generate_hash()}));
	app.use(express.favicon(path.normalize(__dirname + '/../public/favicon.ico')));
	app.use(app.routes);
	app.use(express.static(path.normalize(__dirname + '/../public')));
});

auth.init_routes(app);
play.init_routes(app);
db.init_routes(app);
user.init_routes(app);

app.get('/', function(req, res) {
	render.render_page(req, 'index', {}, function(err, msg) {
		res.send(msg)
	});
});

app.get('/page/:name', function(req, res) {
	render.render_page(req, req.params.name, {}, function(err, msg) {
		res.send(msg);
	});
});

app.get('/user/:name', function(req, res) {
	db.get_user(req.params.name, function(err, user) {
		if(!user) { res.redirect('/page/404'); return; };
		render.render_page(req, 'user', {user: user}, function(err, msg) {
			res.send(msg);
		});
	});
});

app.get('/socket.io/socket.io.js', function(req,res) {
	res.redirect('http://' + req.header('Host').split(':')[0] + ':8081/socket.io/socket.io.js');
});

// **************************************************************

app.get('*', function(req, res){
	render.render_page(req, '404', {}, function(err, msg) {
		res.send(msg);
	});
});

app.listen(8080, function(){
	console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});

