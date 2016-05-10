const WebSocket = require('ws');
const Promise = require('bluebird');

module.exports = ClientConnection;

function ClientConnection() {
    'use strict';
    this.ws = {};
}

ClientConnection.prototype.connect = function (url) {
    'use strict';
	var wsc = this;
    return new Promise((resolve, reject) => {
        wsc.ws = new WebSocket(url);
        wsc.ws.on('open', resolve);
        wsc.ws.on('error', reject);
    });
};

ClientConnection.prototype.disconnect = function () {
    'use strict';
    var wsc = this;
	return new Promise((resolve, reject) => {
		if (wsc.ws) {
			wsc.ws.on('close', resolve);
			wsc.ws.on('error', reject);
			wsc.ws.close();
			wsc.ws = undefined; 
		}
		else
			resolve();	
	});
};

function registerHandler(ws, callback) {
	if (ws) {
		ws.on('message', function fff(message) {
			ws.removeListener('message', fff);
			message = JSON.parse(message);
			if ('status' in message && message.status != 'OK')
				callback(message, undefined);
			else
				callback(undefined, message);
		});
	}
}

ClientConnection.prototype.request = Promise.promisify(function(cmd, callback) {
	this.requestInternal(cmd, true, callback);
});

ClientConnection.prototype.requestNoWait = Promise.promisify(function(cmd, callback) {
	this.requestInternal(cmd, false, callback);
});

ClientConnection.prototype.requestInternal = function(cmd, wait, callback) {
	if (wait && callback)
		registerHandler(this.ws, callback);
	
	var ws = this.ws;
	
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
	case 'gettl':
		send({ type: cmd[0], name: cmd[1] });
		break;
	case 'grant':
	case 'revoke':
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
		send({ type: 'setstate', tasklist: cmd[1], task: cmd[2], state: 'closed' });
		break;
	case 'reopen':
		send({ type: 'setstate', tasklist: cmd[1], task: cmd[2], state: 'reopened' });
		break;
	case 'assign':
		send({ type: 'setstate', tasklist: cmd[1], task: cmd[2], state: 'assigned', user: cmd[3] });
	case 'exit':
		process.exit(0);
		break;
	}
	if (!wait && callback) {
		callback(undefined, undefined);
	}
};

ClientConnection.prototype.receive = Promise.promisify(function(callback) {
	if (callback)
		registerHandler(this.ws, callback);
});

ClientConnection.prototype.receiveUntilCondition = Promise.promisify(function(condition, callback) {
	if (callback) {
		var ws = this.ws;
		ws.on('message', function fff(message) {
			message = JSON.parse(message);
			if ('status' in message && message.status != 'OK') {
				ws.removeListener('message', fff);
				callback(message, undefined);
			}
			else if (condition(message)) {
				ws.removeListener('message', fff);
				callback(undefined, message);
			}
		});
	}
});