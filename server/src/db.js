var mongoose = require('mongoose')
  , bcrypt = require('bcrypt')
  , Schema = mongoose.Schema;

mongoose.connect("mongodb://localhost/league6m");

// ***************************************************
// DATABASE

var BnetCharacterSchema = new Schema({
	name: String
  , code: Number
  , identifier: String
  , server: String
  , link: String
});

var GameSchema = new Schema({
	map: String
  , opponent_name: String
  , result: String
  , rating_diff : Number
  , id: String
});

var UserSchema = new Schema({
	name: String
  , bnet_characters: [BnetCharacterSchema]
  , selected_character: { type: String, default: "" }
  ,	rating: { type: Number, default: 1500 }
  , rd: { type: Number, default: 350  }
  , games_played: { type: Number, default: 0 }
  , games_won: { type: Number, default: 0 }
  , games: [GameSchema]
  , ongoing_games: [GameSchema]
});

var UserPassSchema = new Schema({
	name     : String
  , password : String
});

var User = mongoose.model('User', UserSchema)
  , UserPass = mongoose.model('UserPass', UserPassSchema); 


var encrypt_password = function(password, callback) {
	bcrypt.genSalt(10, function(err, salt) {
		if(err) {
			console.log('Failed to generate salt: ' + err);
		}
		else {
			bcrypt.hash(password, salt, function(err, hash) {
				if(err) {
					console.log('Failed to encrypt: ' + err);
				}
				else {
					callback(hash);
				}
			});
		}
	});
};

var new_user = function(options, callback) {
	User.findOne({name: options.name}, function(err, doc) {
		if(doc) {
			callback('Username ' + options.name + ' is already taken.');
		}
		else {
			encrypt_password(options.password, function(hash) {
				var new_user = new User()
				  , new_user_pass = new UserPass();
				new_user.name = options.name;
				new_user_pass.name = options.name;
				new_user_pass.password = hash;
				new_user.save();
				new_user_pass.save();
				callback(null);
			});
		}
	});
};

var get_user = function(username, callback) {
	User.findOne({name: username}, function(err, doc) {
		if(doc) {
			callback(null, doc);
		}
		else {
			if(err) { callback(err) }
			else { callback('User ' + username + ' does not exist.'); }
		}
	});
};

var user_pass_match = function(username, password, callback) {
	User.findOne({name: username}, function(err, doc) {
		if(doc) {
			UserPass.findOne({name: username}, function(err, pass) {
				bcrypt.compare(password, pass.password, function(err, res) {
					callback(res);
				});
			});
		}
		else {
			callback(false);
		}
	});
};

var update_user_password = function(username, password) {
	encrypt_password(password, function(hash) {
		UserPass.update({name: username}, {password: hash}, {}, 
			function(err) {console.log('Failed to set password: ' + err);});
	});
};

var add_bnet_character = function(username, character, callback) {
	User.update({name: username}, {$push: {bnet_characters: character}}, 
			function(err) {
				if(err) { callback(err); } 
				else { callback(null); } 
			});
};

var remove_bnet_character = function(username, identifier, callback) {
	User.update({name: username}, {$pull: {bnet_characters: {identifier: identifier}}},
			function(err) {
				if(err) { callback(err); }
				else { callback(null); }
			});
};

var select_bnet_character = function(username, identifier, callback) {
	User.update({name: username}, {$set: {selected_character: identifier}},
			function(err) {
				if(err) { callback(err); }
				else { callback(null); }
			});
};

var get_selected_character = function(username, callback) {
	User.findOne({name: username}, function(err, doc) {
		if(err) { callback(err); return; }
		if(!doc) { callback('user not found'); return; }
		if(doc.bnet_characters.length === 0) { callback('no characters'); return; }
		if(doc.selected_character === "") {
			doc.selected_character = doc.bnet_characters[0].identifier;
			doc.save(function(err){ if(err) { console.log('failed to save selected character with error ', err); } });
		}
		var characters = doc.bnet_characters
		  , character;

		for(var i = 0; i < characters.length; i += 1) {
			if(characters[i].identifier == doc.selected_character) {
				character = characters[i];
				break;
			}
		}
		if(!character) { callback('not found'); return; }
		callback(null, character);
	});
};

var add_ongoing_game = function(game) {
	User.update({name: game.host.name}, {$push: {ongoing_games: game}},
			function(err) {
				console.log('failed to update host with ', err);
			});
	User.update({name: game.opponent.name}, {$push: {ongoing_games: game}},
			function(err) {
				console.log('failed to update opponent with ', err);
			});
};

//User.findOne({name: 'h'}, function(err, user) {console.log(user.toObject().ongoing_games[0].host); });

//User.update({name: 'd'}, {$set: {ongoing_games: []}}, function(err) { console.log(err); });

//get_selected_character('h', console.log);

//User.update({name: 'h'}, {$pull: {bnet_characters: { name: 'hello' }}}, function() {
//User.findOne({name: 'h'}, console.log);// });
//add_bnet_character('h', {name: 'hello', code: 340, link: "http://eu.battle.net/sc2/en/profile/2549843/1/Sísyphos/", selected: true});
//User.update({name: 'h'}, {$set: {bnet_characters: [] }}, function(err){});

var get_top50 = function(callback) {
	top_users = [];
	User.find().sort('rating', -1).limit(50).each(function(err, user) { 
		if(err) {
			console.log(err);
			callback(err);
		}
		else if(user) {
			top_users.push(user.toObject());
		}
		else {
			callback(null, top_users);
		}
	});
};

var init_routes = function(app) {
	app.get('/new_user', function(req, res) {
		var options = req.query;
		if(options.password === options.password2) {
			if(options.name.length >= 3) {
				new_user(options, function(err) {
					if(err) {
						res.send(err, 406);
					}
					else {
						res.send('/login?name=' + options.name + '&password=' + options.password);
					}
				});
			}
			else {
				res.send('username is too short', 406);
			}
		}
		else {
			res.send('passwords don\'t match', 406);
		}
	});
};

module.exports.new_user = new_user;
module.exports.get_user = get_user;
module.exports.update_user_password = update_user_password;
module.exports.add_bnet_character = add_bnet_character;
module.exports.remove_bnet_character = remove_bnet_character;
module.exports.select_bnet_character = select_bnet_character;
module.exports.get_selected_character = get_selected_character;
module.exports.user_pass_match = user_pass_match;
module.exports.add_ongoing_game = add_ongoing_game;
module.exports.get_top50 = get_top50;
module.exports.init_routes = init_routes;
