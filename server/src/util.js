var fs = require('fs')
  , crypto = require('crypto');

var endsWith = function(str, suffix) {
	return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

var dir_content_object = function(dir) {
	var filenames = fs.readdirSync(dir)
		, obj = {}
	, name = "";
	for(var i in filenames) {
		name = filenames[i];
		if(endsWith(name, ".html")) {
			obj[name.replace(".html", "")] = fs.readFileSync(dir + name).toString();
		}
	}
	return obj;
};

var generate_hash = function() {
	var current_date = (new Date()).valueOf().toString()
		, random = Math.random().toString();
	return crypto.createHash('sha1').update(current_date + random).digest('hex');
};

module.exports.endsWith = endsWith;
module.exports.dir_content_object = dir_content_object;
module.exports.generate_hash = generate_hash;

