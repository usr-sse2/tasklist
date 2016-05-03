const WebSocket = require('ws');
const Promise = require('bluebird');
const readline = require('readline');
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const ws = new WebSocket('ws://cmc-tasklists-1.herokuapp.com:8060/');


function p(ws, cmd, callback) {
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
		rl.prompt();
		break;
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
	
	// var pAsync = Promise.promisify(p);
//
// 	pAsync(ws, ["login", "u", "p"])
// 	//.then(message => console.log(message))
// 	//.then(() => pAsync(ws, ["login", "usrsse2", "123"]))
// 	.then(message => {
// 		console.log(message);
// 		return pAsync(ws, ["login", "usrsse2", "123"]);
// 	})
// 	.then(message => {
// 		msg = JSON.parse(message);
// 		if (msg.status != "OK")
// 			throw message;
// 	})
// 	.catch(e => console.log('Error: \n' + e.toString()));

	
	// p(ws, ["login", "u", "p"], function(err, message) {
	// 	console.log(message);
	// 	p(ws, ["login", "usrsse2", "123"], function(err, message) {
	// 		console.log(message);
	// 	});
	// });
});