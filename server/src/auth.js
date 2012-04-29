var db = require('./db.js');

var is_auth = function(req, callback) {
	if(req.session && req.session.name && req.session.password) {
		db.user_pass_match(req.session.name, req.session.password, callback);
	}
	else {
		callback(false);
	}
};

var get_auth_user = function(req, callback) {
	is_auth(req, function(auth) {
		if(auth) {
			db.get_user(req.session.name, function(err, user) {
				callback(user.toObject());
			});
		}
		else {
			callback(null);
		}
	});
};

var login = function(req) {
	req.session.name = req.query.name;	
	req.session.password = req.query.password;
};

var logout = function(req) {
	if(req.session) {
		req.session.destroy();
	}
};

var init_routes = function(app) {
	app.get('/login', function(req, res) {
		login(req);
		is_auth(req, function(auth) {
			if(auth) {
				res.send('/user/' + req.query.name);
			}
			else {
				res.send('invalid username or password', 406);
			}
		});
	});

	app.get('/logout', function(req, res) {
		logout(req);
		res.redirect('/');
	});
};

module.exports.is_auth = is_auth;
module.exports.login = login;
module.exports.logout = logout;
module.exports.get_auth_user = get_auth_user;
module.exports.init_routes = init_routes;
