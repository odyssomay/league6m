
var auth = require('./auth.js')
  , db = require('./db.js')
  , user_js = require('./user.js')
  , render = require('./render.js');

var app = require('http').createServer()
  , io = require('socket.io').listen(app)
  , uuid = require('node-uuid');

app.listen(8082);
io.set('log level', 1);

var open_games = [];
var game_usernames = {};
var username_sockets = {};

var broadcast_games = function() {
	io.sockets.emit('games', open_games);
};

io.sockets.on('connection', function (socket) {
	var current_username;
	socket.on('username', function(username) {
		username_sockets[username] = socket;
		current_username = username;
	});

	socket.on('disconnect', function () {
		delete username_sockets[current_username];
		if(game_usernames[current_username]) {
			for(var i = 0; i < open_games.length; i++) {
				if(open_games[i].host.name === current_username) {
					open_games.splice(i, 1);
				}
			}
		}
		delete game_usernames[current_username];
		broadcast_games();
	});

	broadcast_games();
});

var create_game = function(game) {
	if(!(game_usernames[game.host.name])) {
		game_usernames[game.host.name] = game;
		open_games.push(game);
		broadcast_games();
	}
};

var get_confirmation = function(username, from_user, callback) {
	if(!game_usernames[username]) { callback('user ' + username + ' has no current game.'); return; }
	username_sockets[username].emit('confirm game', from_user);
};

var validate_game = function(game, callback) {
	user_js.get_last_match(game.host.name, function(err, host_last_match) {
		if(err) { callback(err); return; }
		user_js.get_last_match(game.opponent.name, function(err, opp_last_match) {
			if(err) { callback(err); return; }
			if(!((host_last_match.name === opp_last_match.name) &&
			     (host_last_match.name === game.map))) {
				callback('Maps doesn\'t match. ' + game.host.name + ' played: ' + host_last_match.name 
					+ ' and ' + game.opponent.name + ' played ' + opp_last_match.name
					+ ' , game map is ' + game.map
					);
			}
			else if((host_last_match.result === 'Win') && (opp_last_match.result === 'Loss')) {
				callback(null, { winner: game.host, loser: game.opponent, map: game.map });
			}
			else if((host_last_match.result === 'Loss') && (opp_last_match.result === 'Win')) {
				callback(null, { winner: game.opponent, loser: game.host, map: game.map });
			}
			else {
				console.log('failed to validate game, host_last_match: ', host_last_match, ' opponent_last_match: ', opp_last_match);
				callback('win/loss doesn\'t match');
			}
		});
	});
};

var get_game_by_id = function(games, id) {
	var game;
	for(var i = 0; i < games.length; i++) {
		if(games[i].id === id) {
			game = games[i];
			break;
		}
	}
	return game;
};

var init_routes = function(app) {
	var ongoing_games = {};
/*
	db.get_user('h', function(err, user) {
		db.get_user('d', function(err, user2) {
			ongoing_games.h = { host: user, opponent: user2, map: 'Devolution' };
		});
	});
*/
	app.get('/new_game', function(req, res) {
		auth.get_auth_user(req, function(user) {
			if(!user) { res.send('Not authorized, please log out/in again.', 401); return; }
			create_game({host: {name: user.name, rating: user.rating}, map: req.query.map, id: uuid.v1()});
			res.send('/page/play');
		});
	});

	app.get('/start_game', function(req, res) {
		auth.get_auth_user(req, function(user) {
			if(!user) { res.send('not authorized', 401); return; }
			if(user.name === req.query.host) { res.send('self'); return; };
			get_confirmation(req.query.host, user, function(err) { res.send(err, 406); });
			res.send();
		});
	});

	app.get('/cancel_confirm_game', function(req, res) {
		auth.get_auth_user(req, function(user) {
			if(!user) { res.send('not authorized', 401); return; }
			var host_socket = username_sockets[req.query.host];
			if(host_socket) {
				host_socket.emit('confirm game cancelled', user.name);
			}
		});
	});

	app.get('/ongoing_games', function(req, res) {
		auth.get_auth_user(req, function(user) {
			if(user && ongoing_games[user.name]) {
				res.send(JSON.stringify(ongoing_games[user.name]));
				return;
			}
			res.send('You have no ongoing games', 406);
		});
	});

	app.get('/accept_game', function(req, res) {
		auth.get_auth_user(req, function(host) {
			if(!host) { res.send('not authorized', 401); return; }
			var opp_username = req.query.opp_username;
			var opp_socket = username_sockets[opp_username];
			var game = game_usernames[host.name];
			if(game && opp_username && opp_socket) {
				db.get_user(opp_username, function(err, user) {
					if(err) { console.log('failed to accept game with error: ', err); return; }
					game.opp_username = opp_username;
					game.opponent = {name: user.name};
					db.add_ongoing_game(game);
					opp_socket.emit('accepted', game.id);
					res.send('/game?id=' + game.id);
				});
				return;
			}
			res.send('/page/play');
		});
	});

	app.get('/decline_game', function(req, res) {
		auth.get_auth_user(req, function(user) {
			if(!user) { res.send('not authorized', 401); return; }
			var opp_socket = username_sockets[req.query.opp_username];
			if(ongoing_games[user.name] && opp_socket) {
				opp_socket.emit('declined', user.name);
			}
			res.send();
		});
	});

	app.get('/game', function(req, res) {
		auth.get_auth_user(req, function(user) {
			if(!user) { res.send('not authorized', 401); return; }
			var game = get_game_by_id(user.ongoing_games, req.query.id);
			if(game && ((user.name === game.host.name) || 
					    (user.name === game.opponent.name))) {
				var env = { game: game };
				if(user.name === game.host.name) { env.is_host = true; };
				render.render_page(req, 'game', env, function(err, msg) {
					res.send(msg);
				});
				return;
			} 
			res.send('not authorized', 401);
		});
	});

	app.get('/validate_game', function(req, res) {
		auth.get_auth_user(req, function(user) {
			if(!user) { res.send('not authorized', 401); return; }
			var game = get_game_by_id(user.ongoing_games, req.query.id);
			if(!game) { res.send('no game with id ' + req.query.id + ' exists.', 406); return };
			if(((user.name === game.host.name) || 
			    (user.name === game.opp_username))) {
				validate_game(game, function(err, result) {
					if(err) { res.send(err, 406); }
					else { 
						user_js.register_game(game.id, result);
						res.send('/user/' + user.name); 
					}
				});
				return;
			}
			res.send('not authorized', 401);
		});
	});
};

module.exports.create_game = create_game;
module.exports.init_routes = init_routes;
