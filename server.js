const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const Collection = mongodb.Collection;
const Cursor = mongodb.Cursor;
const Promise = require('bluebird');
const WebSocketServer = require('ws').Server;

var wss;

function WebSocketServerAsync(options) {
	return new Promise((resolve, reject) => {
		var server = new WebSocketServer(options, function(err) {
			if (err)
				reject(err);
			else
				resolve(server);
		});
	});
}

module.exports.start = function() {
	users2connections = {}; 
	
	Promise.promisifyAll(Collection.prototype);
	Promise.promisifyAll(MongoClient);
	Promise.promisifyAll(Cursor.prototype);
	
	return MongoClient.connectAsync(process.env.MONGODB_URI)
	.then(function(db) {
		dbConnection = db;
		return WebSocketServerAsync({ port: process.env.PORT });
	})
	.then(function(server) {
		wss = server;
		wss.on('connection', onConnection);
	})
	.catch(function(e) {
		console.log(e);
		process.exit(e.code);
	});	
};

module.exports.stop = function() {
	return new Promise((resolve, reject) => {
		wss.close(function(err) {
			if (err)
				reject(err);
			else
				resolve();
		})
	});
};

var users2connections;
var dbConnection;

//module.exports.start();
const OK = JSON.stringify({ status: 'OK' });

function notify(user, message) {
	if (user in users2connections)
		users2connections[user].send(JSON.stringify({ info: message }));
}
function notifyAll(message) {
	wss.clients.forEach(client => client.send(JSON.stringify({ info: message })));
}

function onConnection (ws) {	
	function ok() {
		try {
			ws.send(OK);
		}
		catch(e) {}
	}
	function reply(obj) {
		try{
			ws.send(JSON.stringify(obj));
		}
		catch(e) {}
	}
	function status(msg) {
		reply({ status: msg });
	}
	function checklogin(func) {
		return message => {
			if (login == undefined)
				status('Not logged in');
			else
				func(message);
		}
	}
	function errorhandler(e) {
		reply({ status: 'Error', error: e ? e.toString() : e });
	}
	
	var login = undefined;
	
	const methods = {};
	methods['login'] = message => {
		if (login != undefined) {
			status('Please logout first');
			return;
		}
		dbConnection.collection('usercollection')
		.findOneAsync({ login: message.login, password: message.password })
		.then(user => {
			if (user != undefined) {
				if (message.login in users2connections)
					status('Already logged in in another connection');
				else {
					users2connections[message.login] = ws;
					login = message.login;
					ok();
				}
			}
			else
				status('Wrong login/password');
		})
		.catch(errorhandler);
	};
	methods['id'] = checklogin(() => {
		reply({ status: 'OK', id: login });
	});
	methods['logout'] = checklogin(() => {
		delete users2connections[login];
		login = undefined;
		ok();
	});
	methods['newtl'] = checklogin(message => {
		dbConnection.collection('tasklists')
		.insertAsync(new TaskList(message.name, login))
		.then(ok)
		.then(() => notifyAll(login + ' has created a tasklist ' + message.name))
		.catch(errorhandler);
	});
	methods['deltl'] = checklogin(message => {
		dbConnection.collection('tasklists')
		.removeAsync({ name: message.name, owner: login })
		.then(res => {
			if (res.result.ok == 1 && res.result.n == 1) {
				ok();
				notifyAll(login + ' has deleted tasklist ' + message.name);
			}
			else
				status('Not found or permission denied');
		})
		.catch(errorhandler);
	});
	methods['setstate'] = checklogin(message => {
		const tasklists = dbConnection.collection('tasklists');
	
		var tasklist;
		tasklists.findOneAsync({ name: message.tasklist })
		.then(tl => {
			if (tl == undefined)
				throw 'Tasklist ' + message.tasklist + ' not found';
			
			
			if (tl.allowed.indexOf(login) == -1)
				throw 'Permission denied';
			
			tasklist = tl;
		
			var task = tl.tasks.find(t => t.description == message.task);
			if (task == undefined)
				throw 'Task ' + message.task + ' not found';
		
			switch (message.state) {
			case 'open':
				throw "Can't change state to open, use reopened state";
			case 'closed':
				if (task.status == 'closed')
					throw 'Already closed';
				break;
			case 'reopened':
				if (task.status != 'closed')
					throw 'Already open';
				break;
			case 'assigned':
				if (task.status == 'closed')
					throw 'Already closed. Reopen first to assign';
				
				usercollection.findOneAsync({ login: message.user })
				.then(user => {
					if (user)
						task.assignee = message.user;
					else
						throw 'User not found';
				});
				break;
			default:
				throw 'Invalid state ' + message.state;
			}
			task.status = message.state;
			return tasklists.updateAsync({ _id: tl._id }, tl);
		})
		.then(() => {
			ok();
			for (user of tasklist.allowed)
			notify(user, 
				'State of task ' + message.task + 
				' in tasklist ' + message.tasklist + 
				' has been changed to ' + message.state);
			})
			.catch(errorhandler);
	});
	methods['addtask'] = methods['removetask'] = checklogin(message => {
		const tasklists = dbConnection.collection('tasklists');
	
		var tasklist;
		tasklists.findOneAsync({ name: message.tasklist })
		.then(tl => {
			if (tl == undefined)
				throw 'Tasklist ' + message.tasklist + ' not found';
			if (tl.allowed.indexOf(login) == -1)
				throw 'Permission denied';
			tasklist = tl;
			// ОПОПОП ТРАНЗАКЦИИ
			// Если двое добавят одновременно, добавится только одна задача
			switch (message.type) {
			case 'addtask':
				if (tl.tasks.findIndex(task => task.description == message.description) != -1)
					throw 'Task names should be distinct';
				tl.tasks.push(new Task(message.description));
				break;
			case 'removetask':
				var index = tl.tasks.findIndex(task => task.description == message.description);
				if (index == -1)
					throw 'Task ' + message.description + ' not found in tasklist ' + message.tasklist;
				tl.tasks.splice(index);
				break;
			}
			return tasklists.updateAsync({ _id: tl._id }, tl);
		})
		.then(() => {
			ok();
			for (user of tasklist.allowed) {
				notify(user, login + 
					(message.type == 'addtask' ? ' added new task ' : ' removed task ') +
					message.description + ' in tasklist ' + message.tasklist);
				}
		})
		.catch(errorhandler);
	});
	methods['comment'] = checklogin(message => {
		const tasklists = dbConnection.collection('tasklists');

		var tasklist;

		tasklists.findOneAsync({ name: message.tasklist })
		.then(tl => {
			if (tl == undefined)
				throw 'Tasklist ' + message.tasklist + ' not found';
			tasklist = tl;
			var task = tl.tasks.find(x => x.description == message.task);
			if (task == undefined)
				throw 'Task ' + message.task + ' not found';
			task.comments.push(new Comment(login, message.comment));
			return tasklists.updateAsync({ _id: tl._id }, tl);
		})
		.then(() => {
			ok();
			for (user of tasklist.allowed)
				notify(user, login + ' posted a new comment on task ' + message.task + ' in tasklist ' + message.tasklist);
		})
		.catch(errorhandler);
	});
	methods['getall'] = () => {
		dbConnection.collection('tasklists')
		.findAsync()
		.then(data => data.toArrayAsync())
		.then(results => { 
			reply({ 
				status: 'OK', 
				type: 'tasklists', 
				tasklists: results.map(x => {
					delete x._id;
					return x;
				}) 
			}); 
		})
		.catch(errorhandler);
	};
	methods['gettl'] = (message) => {
		dbConnection.collection('tasklists')
		.findOneAsync({ name: message.name })
		.then(tasklist => {
			if (tasklist) {
				delete tasklist._id;
				reply({ 
					status: 'OK', 
					type: 'tasklist', 
					tasklist: tasklist 
				});
			}
			else
				reply({ status: 'Not found' });
		})
		.catch(errorhandler);
	};
	methods['grant'] = checklogin(message => {
		var tasklist;

		const tasklists = dbConnection.collection('tasklists');
		const usercollection = dbConnection.collection('usercollection');

		tasklists.findOneAsync({ name: message.tasklist })
		.then((tl) => {
			tasklist = tl;
			if (tasklist == undefined)
				throw('Tasklist ' + message.tasklist + ' not found');
			if (tasklist.owner != login)
				throw('Only owner can change permissions');

			return usercollection.findOneAsync({ login: message.user });
		})
		.then(user => {
			if (user == undefined)
				throw('User not found' );
			switch (message.type) {
			case 'grant':
				if (tasklist.allowed.indexOf(message.user) == -1)
					tasklist.allowed.push(message.user);
				else
					throw('User already has permissions');
				break;
			case 'revoke':
				var index = tasklist.allowed.indexOf(message.user); 
				if (index != -1) 
					tasklist.allowed.splice(index);
				else
					throw("User didn't have permissions");
				break;
			}
			return tasklists.updateAsync({ _id: tasklist._id }, tasklist);
		})
		.then(() => {
			ok();
			notify(message.user, 'Now you ' +
			(message.type == 'grant' ? '' : "don't ") +
			'have modification rights for tasklist ' + message.tasklist);
		})
		.catch(errorhandler);
	});
	methods['revoke'] = methods['grant'];

	ws.on('message', function incoming(message) {
		message = JSON.parse(message);
		methods[message.type](message);
	});
	ws.on('close', function(reasonCode, description) {
		if (login != undefined)
			delete users2connections[login];
	});
}

function Comment(author, text) {
	this.author = author;
	this.text = text;
	this.date = new Date();
}

function Task(description) {
	this.description = description;
	this.status = 'open';
	this.comments = [];
}

function TaskList(name, owner) {
	this.name = name;
	this.owner = owner;
	this.allowed = [owner];
	this.tasks = [];
} 