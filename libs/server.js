var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var Collection = mongodb.Collection;
var Cursor = mongodb.Cursor;
var Promise = require('bluebird');

Promise.promisifyAll(Collection.prototype);
Promise.promisifyAll(MongoClient);
Promise.promisifyAll(Cursor.prototype);
/* 
var myCollection;
var db;
 
function removeDocument(onRemove){
    myCollection.findAndModify({name: "doduck"}, [], {remove:true}, function(err, object) {
        if(err)
            throw err;
        console.log("document deleted");
        onRemove();
    });
}
 
function findDocument(onFinded){
    var cursor = myCollection.find({"name" : "doduck", "company.officialName" : "doduck LTD" });
    cursor.each(function(err, doc) {
        if(err)
            throw err;
        if(doc==null)
            return;
 
        console.log("document find:");
        console.log(doc.name);
        console.log(doc.company.employed);
        onFinded();
    });
}
 
function fieldComplexeUpdateDocument(onUpdate){
    myCollection.update({name: "doduck"}, {$set: {company: {employed: 10, officialName: "doduck LTD", industries: ["it consulting", "passionate programming"]}}}, {w:1}, function(err) {
        if(err)
            throw err;
        console.log('entry updated');
        onUpdate();
    });
}
 
function fieldUpdateDocument(onUpdate){
    myCollection.update({name: "doduck"}, {$set: {industry: "France"}}, {w:1}, function(err) {
        if(err)
            throw err;
        console.log('entry updated');
        onUpdate();
    });
}
 
function simpleUpdateDocument(onUpdate){
    myCollection.update({name: "doduck"}, {name: "doduck", description: "prototype your idea"}, {w:1}, function(err) {
    if(err)
        throw err;
        console.log('entry updated');
        onUpdate();
    });
}
 
function addDocument(onAdded){
    myCollection.insert({name: "doduck", description: "learn more than everyone"}, function(err, result) {
        if(err)
            throw err;
 
        console.log("entry saved");
        onAdded();
    });
}
 
function createConnection(onCreate){
    MongoClient.connect('mongodb://127.0.0.1:27017/test', function(err, db) {
        if(err)
            throw err;
        console.log("connected to the mongoDB !");
        myCollection = db.collection('test_collection');
 
        onCreate();
    });
}
 
createConnection(function(){
    addDocument(function(){
        simpleUpdateDocument(function(){
            fieldUpdateDocument(function(){
                fieldComplexeUpdateDocument(function(){
                    findDocument(function(){
                        removeDocument(function(){
                            console.log("The end");
                        });
                    });
                });
            });
        });
    });
});

*/


const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({ port: 8060 }); // это сервер

const url = require('url');

var users2connections = {};

var dbConnection;
MongoClient.connectAsync('mongodb://localhost:27017/test')
.then(function(db) {
	dbConnection = db;
})
.catch(function(e) {
	console.log(e);
	process.exit(e.code);
});

function Comment(author, text) {
	// Author
	// Text
	// Date
	this.author = author;
	this.text = text;
	this.date = new Date();
}

function Task(description) {
	// Description
	// Status
	// Comments
	this.description = description;
	this.status = 'open';
	this.comments = [];
}

function TaskList(name, owner) {
	// Name
	// Owner
	// Allowed users
	// Tasks	
	this.name = name;
	this.owner = owner;
	this.allowed = [owner];
	this.tasks = [];
}


// Права:
// удалять список – только владелец
// добавлять, удалять права – только владелец
// добавлять, удалять, менять статус задачи – у кого есть права
// смотреть, комментировать задачи – все

const OK = JSON.stringify({ status: 'OK' });

function notify(user, message) {
	if (user in users2connections)
		users2connections[user].send(JSON.stringify({ info: message }));
}

function notifyAll(message) {
	wss.clients.forEach(client => client.send(JSON.stringify({ info: message })));
}

wss.on('connection', function connection(ws) { // ws - это соединение
	const methods = {};
	
	function ok() {
		ws.send(OK);
	}
	function reply(obj) {
		ws.send(JSON.stringify(obj));
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
	
	methods['addtask'] = checklogin(message => {
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
				tl.tasks.splice(tl.tasks.findIndex(task => task.description == message.description));
				break;
			}
			return tasklists.updateAsync({ _id: tl._id }, tl);
		})
		.then(() => {
			ok();
			for (user of tasklist.allowed)
				notify(user, login + 
					(message.type == 'addtask' ? ' added new task ' : ' removed task ') +
					message.description + ' in tasklist ' + message.tasklist);
		})
		.catch(errorhandler);
	});
	
	methods['removetask'] = methods['addtask'];
	
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
		.then(results => { reply({ status: 'OK', type: 'tasklists', tasklists: results }); })
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
//	methods.message = (message) => {
//		message.from = ws.data_id;
//		wss.clients.forEach((client) => client.send(JSON.stringify(message)));
//	}
	// send message to all clients except current
	
	
	ws.on('message', function incoming(message) {
	  message = JSON.parse(message);
	  methods[message.type](message);
  	});
  	ws.on('close', function(reasonCode, description) {
  		if (login != undefined)
  			delete users2connections[login];
  	});
});


var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser());


app.post('/register', function(req, res) {
	dbConnection.collection('usercollection').insertAsync({
        "login" : req.body.login,
    	"password" : req.body.password
	 })
	 .then(function() {
		res.write('Registration successful\n');
		res.write('Your login: ' + req.body.login + '\n');
		res.write('Your password: ' + req.body.password + '\n');
		res.end();
    })
    .catch(function(e) { return typeof(e) == mongodb.WriteError && e.code == 11000; }, function() {
    	res.send("Already registered");
    	res.end();
    })
    .catch(function(e) {
        res.write("There was a problem adding the information to the database:\n");
		res.write(e.toString());
		res.end(); 
    });
});
app.use(express.static(__dirname + '/html'));
app.listen(5678);