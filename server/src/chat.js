
var app = require('http').createServer()
  , io = require('socket.io').listen(app)
  , sanitize = require('validator').sanitize;

app.listen(8081);
io.set('log level', 1);

var users_in_chat = {}
  , anonymous_ids = {}
  , amount_anonymous = 0;

io.sockets.on('connection', function (socket) {
	socket.on('user message', function (msg) {
		io.sockets.emit('user message', socket.nickname, sanitize(msg).entityEncode());
	});

	socket.on('username', function (nick, is_anonymous) {
		if (!users_in_chat[nick]) {
			if(is_anonymous) {
				socket.is_anonymous = true;
				amount_anonymous += 1;
				while(!socket.nickname) {
					var new_id = Math.floor(Math.random()*10000);
					if(!anonymous_ids[new_id]) {
						anonymous_ids[new_id] = new_id;
						socket.anonymous_id = new_id;
						socket.nickname = 'Anonymous' + new_id;
					}
				}
			}
			else {
				users_in_chat[nick] = socket.nickname = nick;
			}
			io.sockets.emit('usernames', users_in_chat, amount_anonymous);
		}
	});

	socket.on('disconnect', function () {
		if (socket.nickname) {
			delete users_in_chat[socket.nickname];
		}
		if (socket.is_anonymous) {
			delete anonymous_ids[socket.anonymous_id];
			amount_anonymous -= 1;
		}
		socket.broadcast.emit('usernames', users_in_chat, amount_anonymous);
	});
});

