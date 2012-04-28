var auth = require('./auth.js')
  , db = require('./db.js');

var jsdom = require('jsdom')
  , check = require('validator').check;

/*
jsdom.env('http://eu.battle.net/sc2/en/profile/2549843/1/Sísyphos/matches', function(err, window) {
			console.log(window.document.getElementsByClassName('custom')['0'].innerHTML);
		});
*/

var get_last_match_from_url = function(player_url, callback) {
	jsdom.env(player_url, function(err, window) {
		if(err) { 
			callback(err.message);
		}
		else {
			try {
				var custom_element = window.document.getElementsByClassName('custom')['0']
				  , td_elements = custom_element.getElementsByTagName('td')
				  , ch_nodes = td_elements['0'].getElementsByTagName('div')['0'].childNodes;

				callback(null, {
					name: td_elements['1'].innerHTML
					, speed: ch_nodes[ch_nodes.length - 1].nodeValue.trim()
					, result: td_elements['3'].getElementsByTagName('span')['0'].innerHTML
				});
			}
			catch (e) {
				console.log('failed to parse url: ' + player_url + ' with error ' + e + '\n', e);
				callback('invalid url path');
			}
		}
	});
};

var get_last_match = function(username, callback) {
	if(username === 'd') { callback(null, { name: '6m FRB Cross Point', speed: 'Faster', result: 'Win' }); return; };
	db.get_selected_character(username, function(err, character) {
		if(err) { callback(err); return; }
		get_last_match_from_url(character.link + 'matches', callback);
	});
};

var q = Math.log(10)/400;

var g = function(rd) {
	return 1 / Math.sqrt(1 + 3*Math.pow(q, 2)*Math.pow(rd, 2)/Math.pow(Math.PI, 2));
};

var E = function(r, opp_r, opp_rd) {
	return 1 / (1 + 1/Math.pow(10, g(opp_rd) * (r - opp_r) / 400));
};

var d2 = function(r, opp_r, opp_rd) {
	var E_res = E(r, opp_r, opp_rd);
	return 1/(Math.pow(q, 2)*Math.pow(g(opp_rd), 2)*E_res*(1-E_res));
}

var new_rating = function(user, opponent, result) {
	var r = user.rating
	  , rd = user.rd
	  , opp_r = opponent.rating
	  , opp_rd = opponent.rd
	  , cur_d2 = d2(r, opp_r, opp_rd);
	var new_r = r + q / (1/Math.pow(rd, 2) + 1/cur_d2) * g(opp_rd) * (result - E(r, opp_r, opp_rd));
	var new_rd = Math.sqrt(1/(1/Math.pow(rd, 2) + 1/cur_d2));
	return { r: new_r, rd: new_rd };
};

var register_game = function(result) {
	db.get_user(result.winner.name, function(err, winner) {
		if(err) { console.log('failed to get winner with error ', err); return; };
		db.get_user(result.loser.name, function(err, loser) {
			if(err) { console.log('failed to get loser with error ', err); return; };
			var winner_r = new_rating(result.winner, result.loser, 1);
			var loser_r = new_rating(result.loser, result.winner, 0);
			winner.games.unshift({
				opponent_name: result.loser.name
				, map: result.map
				, result: true
				, rating_diff: Math.round(winner_r.r - result.winner.rating) 
			});
			loser.games.unshift({
				opponent_name: result.winner.name
				, map: result.map
				, result: null
				, rating_diff: Math.round(loser_r.r - result.loser.rating) 
			});
			winner.rating = Math.round(winner_r.r);
			winner.rd = winner_r.rd;
			winner.games_played += 1;
			winner.games_won += 1;
			loser.rating = Math.round(loser_r.r);
			loser.rd = loser_r.rd;
			loser.games_played += 1;
			winner.save(function(err) { if(err) { console.log('failed to save winner with error ', err); }});
			loser.save(function(err) { if(err) { console.log('failed to save loser with error ', err); }});
		});
	});
};

//get_last_match_from_url("http://eu.battle.net/sc2/en/profile/2549843/1/Sísyphos/matches", console.log);

var init_routes = function(app) {
	var characters_pending = {};

	var maps = ["Agria Valley", "Arid Plateau", "Blistering Sands", "Burial Grounds", "Cloud Kingdom LE"]
	  , speeds = ["Slower", "Slow", "Normal", "Fast", "Faster"];
	var random_game = function() {
		var rand_map = maps[Math.floor(Math.random() * (maps.length - 1))]
			, speed = speeds[Math.floor(Math.random() * (speeds.length - 1))]; 
		return { name: rand_map, speed: speed };
	};

	app.get('/new_character', function(req, res) {
		auth.get_auth_user(req, function(user) {
			if(user) {
				var p_ch = req.query; // pending character

				console.log(p_ch.code);
				try {check(p_ch.code).isInt();} catch (e) { res.send('code must be a number', 406); return; };
//				try {check(p_ch.link).isUrl();} catch (e) { res.send('link is not valid', 406); return; };

				var game = random_game();
				p_ch.game = game;
				characters_pending[user.name] = p_ch;
				res.send(JSON.stringify(game));
			}
			else {
				res.send('user not authorized', 403);
			}
		});
	});

	app.get('/validate_character', function(req, res) {
		auth.get_auth_user(req, function(user) {
			if(user) {
				var p_ch = characters_pending[user.name]
				  , game = p_ch.game;

				if(!(p_ch)) { res.send('no pending character', 406); return; };
				get_last_match_from_url(p_ch.link + 'matches', function(err, last_map) {
					if(err) { res.send(err, 406); return; }
					else {
						if((last_map.name === game.name) && (last_map.speed === game.speed)) {
							delete p_ch.game;
							p_ch.identifier = p_ch.name + '.' + p_ch.code;
							db.add_bnet_character(user.name, p_ch, function(err) {
								if(err) { res.send(err, 500); return; }
								res.send('success');
								p_ch = null;
								delete characters_pending[user.name];
							});
							return;
						}
						res.send('you played ' + last_map.name + ' on speed ' + last_map.speed + ' which is incorrect.', 406);
					}
				});
			}
			else { 
				res.send('user not authorized', 403); 
			}
		});
	});

	app.get('/remove_character', function(req, res) {
		auth.get_auth_user(req, function(user) {
			if(!user) { res.send('not authorized', 403); return; }
			db.remove_bnet_character(user.name, req.query.identifier, 
				function(err) {
					if(err) { res.send(err, 500); }
					else { res.redirect('/page/options'); }
				});
		});
	});

	app.get('/select_character', function(req, res) {
		auth.get_auth_user(req, function(user) {
			if(!user) { res.send('not authorized', 403); return; }
			db.select_bnet_character(user.name, req.query.identifier,
				function(err) {
					if(err) { res.send(err, 500); }
					else { res.redirect('/page/options'); }
				});
		});
	});

	app.get('/new_password', function(req, res) {
		var new_pass = req.query.password_input
		  , new_pass2 = req.query.password_input2
		  , old_pass = req.query.old_password;
		if(new_pass === new_pass2) {
			auth.get_auth_user(req, function(user) {
				if(user) {
					db.user_pass_match(user.name, old_pass, function(match) {
						if(match) {
							db.update_user_password(user.name, new_pass); 
							res.send('success');
						}
						else {
							res.send('current password is incorrect', 406);
						}
					});
				}
			});
		}
		else {
			res.send('passwords don\'t match', 406);
		}
	});
};

module.exports.get_last_match = get_last_match;
module.exports.register_game = register_game;
module.exports.init_routes = init_routes;

