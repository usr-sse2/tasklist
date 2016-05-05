module.exports.p = function(ws, cmd, callback) {
	if (callback)
		//ws.on('message', callback);
		ws.on('message', function fff(message) {
			ws.removeListener('message', fff);
			callback(undefined, message);
		});
	function send(object) {
		return ws.send(JSON.stringify(object));
	}
	
	switch (cmd[0]) {
	case 'help':
		console.log('general: help exit');
		console.log('user: login id logout');
		console.log('tasklist: getall newtl deltl grant revoke');
		console.log('task: addtask removetask close reopen comment');
		break;
	case 'login':
		send({ type: cmd[0], login: cmd[1], password: cmd[2] });
		break;
	case 'id':
	case 'logout':
	case 'getall':
		send({ type: cmd[0] });
		break;
	case 'newtl':
	case 'deltl':
		send({ type: cmd[0], name: cmd[1] });
		break;
	case 'grant':
	case 'revoke': // revoke doesn't work
		send({ type: cmd[0], tasklist: cmd[1], user: cmd[2] });
		break;
	case 'addtask':
	case 'removetask':
		send({ type: cmd[0], tasklist: cmd[1], description: cmd[2] });
		break;
	case 'comment':
		send({ type: cmd[0], tasklist: cmd[1], task: cmd[2], comment: cmd[3] });
		break;
	case 'close':
	case 'reopen':
		send ({ type: 'setstate', tasklist: cmd[1], task: cmd[2], state: cmd[0] + 'ed'});
		break;
	case 'exit':
		process.exit(0);
		break;
	}
};