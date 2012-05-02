var url = 'http://' + window.location.host.split(':')[0] + ':8081';
var socket = io.connect(url);
socket.on('connect', function() {
	socket.emit('username', username, is_anonymous);
});

$(function() {
	$('#message-input').keypress(function(e) {
		if(e.which == 13) {
			socket.emit('user message', $('#message-input').val());
			$('#message-input').val('').focus();
			e.preventDefault();
			return false;
		}
	});

	socket.on('user message', function(username, message) {
		var d = new Date();
		var m_c = $('#messages-container');
		m_c.append('<span class="message-date">' + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes() +
			'</span><span class="message-user">' + username + '</span>: <span class="message">' + message + '</span><br>');
		m_c.scrollTop(m_c.prop("scrollHeight"));
	});

	socket.on('usernames', function (usernames, amount_anonymous) {
		$('#user-list').empty();
		for (var i in usernames) {
			$('#user-list').append('<a href="/user/' + usernames[i] + '">' + usernames[i] + '</a><br>');
		}
		var user_plural = "";
		if(!(amount_anonymous === 1)) {
			user_plural = "s";
		}
		if(!amount_anonymous) {
			amount_anonymous = "no";
		}
		$('#user-list').append('<p class="anonymous_count">' + amount_anonymous + ' anonymous user' + user_plural);
	});
});
