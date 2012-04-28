
var util = require('./util.js')
  , data = require('./data.js')
  , auth = require('./auth.js');

var whiskers = require('whiskers');

var partials = util.dir_content_object(__dirname + "/../partials/")
  , pages = util.dir_content_object(__dirname + "/../views/");

var get_env = function(req, env, callback) {
	env.maps = data.maps;
	env.partials = partials;
	auth.get_auth_user(req, function(user) {
		env.auth_user = user;
		callback(env);
	});
};

var render_page = function(req, name, env, callback) {
	get_env(req, env, function(env) {
		callback(null, whiskers.render(pages[name], env));
	});
};

module.exports.render_page = render_page;
