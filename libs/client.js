const WebSocket = require('ws');
const readline = require('readline');
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const ws = new WebSocket('ws://127.0.0.1:8060/');

function p(ws, cmd) {
	function send(object) {
		return ws.send(JSON.stringify(object));
	}
	
	switch (cmd[0]) {
	case 'help':
		console.log('general: help exit');
		console.log('user: login id logout');
		console.log('tasklist: getall newtl deltl grant revoke');
		console.log('task: addtask removetask close reopen comment');
	case 'login':
		send({ type: cmd[0], login: cmd[1], password: cmd[2] });
		break;
	case 'id':
	case 'logout':
	case 'getall':
		send({ type: cmd[0] });
		break;
	case 'getall':
		rl.prompt();
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
		rl.write('\n');
		process.exit(0);
	}
}



// cli
ws.on('open', function open() {

	ws.on('message', function(message) {
		message = JSON.parse(message);
		if ('type' in message) {
			switch (message.type) {
			case 'tasklists':
				for (tl of message.tasklists) {
					console.log(tl.name);
					console.log('\tOwner: ' + tl.owner);
					console.log('\tAllowed users: ' + tl.allowed);
					console.log('\tTasks:');
					for (task of tl.tasks) {
						console.log('\t\t' + task.description);
						console.log('\t\t\t' + task.status);
						console.log('\t\t\tDiscussion:');
						for (comment of task.comments) {
							console.log('\t\t\t\t' + comment.author + 
							' said at ' + comment.date.toString() + ':');
							console.log('\t\t\t\t\t' + comment.text);
						}
					}
					console.log();
				}
				break;
			default:
				console.log('Unsupported message ' + message.type);
			}
		}
		else
			console.log(message);
		rl.prompt();
	});


	rl.setPrompt('> ');
	rl.prompt();
	rl.on('line', line => {
		var cmd = line.split(' ');
		p(ws, cmd);
	}).on('close', () => {
		rl.write('\n');
		process.exit(0);
	});
});