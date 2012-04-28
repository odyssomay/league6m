
var app = require('http').createServer()
  , io = require('socket.io').listen(app)
  , sanitize = require('validator').sanitize;

app.listen(8083);
io.set('log level', 1);

var username_sockets = {};

io.sockets.on('connection', function (socket) {
	var username;
	socket.on('user message', function (msg) {
		io.sockets.emit('user message', socket.nickname, sanitize(msg).entityEncode());
	});

	socket.on('username', function (name) {
		username_sockets[name] = socket;
		username = name;
	});

	socket.on('disconnect', function () {
		delete username_sockets[username];
	});
});

