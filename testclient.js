const WebSocket = require('ws');
const Promise = require('bluebird');
const Client = require('./register/html/libclient.js');
const ws = new WebSocket('ws://cmc-tasklists.herokuapp.com/');


function checkstatus(desired) {
	return function(message) {
		var msg = JSON.parse(message);
		if (msg.status != desired)
			throw message;
	}
}

// cli
ws.on('open', function() {
	var pAsync = Promise.promisify(Client.p);

	pAsync(ws, ['login', 'u', 'p'])
	.then(checkstatus('OK'))
	.then(() => pAsync(ws, ['login', 'usrsse2', '123']))
	.then(checkstatus('Please logout first'))
	.then(() => {
		console.log('Test passed');
		process.exit(0);
	})
	.catch(e => console.log('Error: \n' + e.toString()));
});