const WebSocket = require('ws');
const Promise = require('bluebird');
const ClientConnection = require('../register/html/libclient.js');
const chai = require('chai');
const assert = chai.assert;
const should = chai.should();
const chaiAsPromised = require('chai-as-promised');
const Server = require('../server.js');
chai.use(chaiAsPromised);

const url = 'ws://localhost:' + process.env.PORT;

var client;
function connect() {
	client = new ClientConnection();
	return client.connect(url);
}

function disconnect() {
	return client.request(['logout'])
	.catch(() => undefined)
	.then(() => client.disconnect());
}

before(Server.start);
after(Server.stop);

describe('Login', function() {	
	beforeEach(connect);
	afterEach(disconnect);

	it('responds with OK on correct login and password', function() {
		return client.request(['login', 'u', 'p'])
		.should.become({ status: 'OK' })
		.then(() => client.request(['id']))
		.should.become({ status: 'OK', id: 'u' });
	});
	
	it('responds with error on incorrect login and password', function() {
		return client.request(['login', 'u', 'password']).should.be.rejected//become({ status: 'Wrong login/password' })
		.then(() => client.request(['id']).should.be.rejected);
		//become({ status: 'Not logged in' });
	});
	
	it('can logout and login as different user', function() {
		return client.request(['login', 'u', 'p'])
		.then(() => client.request(['id']))
		.should.become({ status: 'OK', id: 'u' })
		.then(() => client.request(['logout']))
		.then(() => client.request(['id']).should.be.rejected)
		.then(() => client.request(['login', 'usrsse2', '123']))
		.then(() => client.request(['id']))
		.should.become({ status: 'OK', id: 'usrsse2' });
	});
	
	it("can't login twice without logout", function() {
		return client.request(['login', 'u', 'p']).should.be.fulfilled
		.then(() => client.request(['login', 'usrsse2', '123']).should.be.rejected);
	});
	
	it('can login as different users in two connections', function() {
		var c2 = new ClientConnection();
		return client.request(['login', 'u', 'p'])
		.then(() => c2.connect(url))
		.then(() => c2.request(['login', 'usrsse2', '123']))
		.then(() => client.request(['id']))
		.should.become({ status: 'OK', id: 'u' })
		.then(() => c2.request(['id']))
		.should.become({ status: 'OK', id: 'usrsse2' })
		.then(() => client.request(['logout']))
		.then(() => c2.request(['logout']))
		.catch((e) => {
			c2.disconnect();
			throw e;
		});
	});
	
	it("can't login as the same user in two connections", function() {
		var c2 = new ClientConnection();
		return client.request(['login', 'u', 'p'])
		.then(() => c2.connect(url))
		.then(() => c2.request(['login', 'u', 'p']).should.be.rejected)
		.then(() => c2.disconnect());
	});
});


function connectAndLogin(done) {
	client = new ClientConnection();
	client.connect('ws://localhost:' + process.env.PORT)
	.then(() => client.request(['login', 'u', 'p']))
	.then(() => done())
	.catch(done);	
}

describe('Tasklist', function() {
	beforeEach(connectAndLogin);
	afterEach(disconnect);
	
	var tlname;
	
	it('successfully creates and gets tasklist', function() {
		tlname = '     __test_tasklist' + new Date().toString();
		return client.request(['newtl', tlname])
		.should.become({ status: 'OK' });
	});
	
	it('successfully gets all tasklists', function() {
		return client.request(['getall'])
		.then(x => x.tasklists)
		.should.eventually.contain({
			name: tlname, 
			owner: "u", 
			allowed:["u"],
			tasks:[]
		});
	});
	
	it('successfully gets tasklist by name', function() {
		return client.request(['gettl', tlname])
		.should.become({
			status: 'OK',
			type: 'tasklist',
			tasklist: {
				name: tlname, 
				owner: "u", 
				allowed:["u"],
				tasks:[]
			}
		});
	});
	
	it('grants another user access rights for tasklist', function() {
		return client.request(['grant', tlname, 'usrsse2'])
		.then(() => client.request(['gettl', tlname]))
		.then(x => x.tasklist)
		.should.become({
			name: tlname,
			owner: 'u',
			allowed: ['u', 'usrsse2'],
			tasks: []
		});
	});
	
	it("can't grant a non-existing user access rights", function() {
		return client.request(['grant', tlname, 'usrsse3']).should.be.rejected;
	});
	
	it("can't grant a user access rights twice", function() {
		return client.request(['grant', tlname, 'usrsse2']).should.be.rejected;
	});
		
	it('allows granted user to add task', function() {
		return client.request(['logout'])
		.then(() => client.request(['login', 'usrsse2', '123']))
		.then(() => client.request(['addtask', tlname, 'Task 1']))
		.then(() => client.requestNoWait(['gettl', tlname]))
		.then(() => client.receiveUntilCondition(x => 'tasklist' in x))
		.then(x => x.tasklist)
		.should.become({
			name: tlname,
			owner: 'u',
			allowed: ['u', 'usrsse2'],
			tasks: [{
				description: 'Task 1',
				status: 'open',
				comments: []
			}]
		});
	});
	
	it('allows owner to add and remove tasks', function() {
		return client.request(['addtask', tlname, 'Task 4'])
		.then(() => client.requestNoWait(['gettl', tlname]))
		.then(() => client.receiveUntilCondition(x => 'tasklist' in x))
		.then(x => x.tasklist)
		.should.become({
			name: tlname,
			owner: 'u',
			allowed: ['u', 'usrsse2'],
			tasks: [
			{
				description: 'Task 1',
				status: 'open',
				comments: []
			},
			{
				description: 'Task 4',
				status: 'open',
				comments: []
			}]
		})
		.then(() => client.request(['removetask', tlname, 'Task 4']))
		.then(() => client.requestNoWait(['gettl', tlname]))
		.then(() => client.receiveUntilCondition(x => 'tasklist' in x))
		.then(x => x.tasklist)
		.should.become({
			name: tlname,
			owner: 'u',
			allowed: ['u', 'usrsse2'],
			tasks: [{
				description: 'Task 1',
				status: 'open',
				comments: []
			}]
		});
	});
	
	it("doesn't allow non-owner to revoke", function() {
		return client.request(['logout'])
		.then(() => client.request(['login', 'usrsse2', '123']))
		.then(() => client.request(['revoke', tlname, 'usrsse2']).should.be.rejected);
	});
	
	it('revokes access right for tasklist from user', function() {
		return client.request(['revoke', tlname, 'usrsse2'])
		.then(() => client.request(['gettl', tlname]))
		.then(x => x.tasklist)
		.should.become({
			name: tlname,
			owner: 'u',
			allowed: ['u'],
			tasks: [{
				description: 'Task 1',
				status: 'open',
				comments: []
			}]
		});
	});
	
	it("can't revoke access rights from user twice", function() {
		return client.request(['revoke', tlname, 'usrsse2']).should.be.rejected;
	});
	
	it("doesn't allow revoked user to add tasks", function() {
		return client.request(['logout'])
		.then(() => client.request(['login', 'usrsse2', '123']))
		.then(() => client.request(['addtask', tlname, 'Task 2']).should.be.rejected);
	});
	it("doesn't allow revoked user to remove tasks", function() {
		return client.request(['logout'])
		.then(() => client.request(['login', 'usrsse2', '123']))
		.then(() => client.request(['removetask', tlname, 'Task 1']).should.be.rejected);
	});
	it("doesn't allow revoked user to change task state", function() {
		return client.request(['logout'])
		.then(() => client.request(['login', 'usrsse2', '123']))
		.then(() => 
			client.request(['close', tlname, 'Task 1']).should.be.rejected);
	});
	
	it("can't reopen an open task", function() {
		return client.request(['reopen', tlname, 'Task 1']).should.be.rejected;
	});	
	
	it("can close a task", function() {
		return client.request(['close', tlname, 'Task 1'])
		.then(() => client.receive())
		.then(() => client.request(['gettl', tlname]))
		.then(x => x.tasklist)
		.should.become({
			name: tlname,
			owner: 'u',
			allowed: ['u'],
			tasks: [{
				description: 'Task 1',
				status: 'closed',
				comments: []
			}]
		});
	});
	
	it("can't close a closed task", function() {
		return client.request(['close', tlname, 'Task 1']).should.be.rejected;
	});	

	it("can reopen a task", function() {
		return client.request(['reopen', tlname, 'Task 1'])
		.then(() => client.receive())
		.then(() => client.request(['gettl', tlname]))
		.then(x => x.tasklist)
		.should.become({
			name: tlname,
			owner: 'u',
			allowed: ['u'],
			tasks: [{
				description: 'Task 1',
				status: 'reopened',
				comments: []
			}]
		});
	});

	it("can't reopen a reopened task", function() {
		return client.request(['reopen', tlname, 'Task 1']).should.be.rejected;
	});	
	
	it("doesn't allow to add the same task twice", function() {
		return client.request(['addtask', tlname, 'Task 1']).should.be.rejected;
	});
	
	it("can't add a task to non-existing tasklist", function() {
		return client.request(['addtask', tlname + '$', 'Task 3']).should.be.rejected;
	});
	
	it("can't remove a non-existing task", function() {
		return client.request(['removetask', tlname, 'Task 0']).should.be.rejected;
	});
	
	it("can't change state of a non-existing task", function() {
		return client.request(['close', tlname, 'Task 0']).should.be.rejected;
	});
	
	it('posts a comment', function() {
		return client.requestNoWait(['comment', tlname, 'Task 1', 'Comment 1'])
		.then(() => client.receiveUntilCondition(x => 'info' in x))
		.should.become({
			info: 'u posted a new comment on task Task 1 in tasklist ' + tlname
		})
		.then(() => client.request(['gettl', tlname]))
		.then(x => {
			var l = x.tasklist.tasks[0].comments[0];
			delete l.date;
			return x;
		})
		.should.become({
			status: 'OK',
			type: 'tasklist',
			tasklist: {
				name: tlname,
				owner: 'u',
				allowed: ['u'],
				tasks: [{
					description: 'Task 1',
					status: 'reopened',
					comments: [{
						author: 'u',
						text: 'Comment 1'
					}]
				}]
			}
		});
	});
	
	it("can't post a comment to non-existing task", function() {
		return client.request(['comment', tlname, 'Task 5', 'Comment 1']).should.be.rejected;
	});
	
	it('successfully deletes tasklist', function() {
		return client.request(['deltl', tlname])
		.should.become({ status: 'OK'});
	});
	
	it('verifies that tasklist was deleted', function() {
		return client.request(['getall'])
		.then(x => x.tasklists)
		.should.not.eventually.contain({
			name: tlname, 
			owner: "u", 
			allowed:["u"],
			tasks:[]
		});
	});
	
	it("can't delete tasklist twice", function() {
		return client.request(['deltl', tlname]).should.be.rejected;
	});
	
	it("can't get a deleted tasklist", function() {
		return client.request(['gettl', tlname]).should.be.rejected;
	});
	
	it("can't post a comment to non-existing task", function() {
		return client.request(['comment', tlname, 'Task 1', 'Comment 1']).should.be.rejected;
	});	
	
	it("can't grant a user access to non-existing tasklist", function() {
		return client.request(['grant', tlname, 'usrsse2']).should.be.rejected;
	});
	
	it("can't change state of a task in a non-existing tasklist", function() {
		return client.request(['close', tlname, 'Task 1']).should.be.rejected;
	});
});

describe('Multiuser', function() {
	var u;
	var usrsse2;
	
	var tlname;
	
	before(function() {
		tlname = '     __test_tasklist' + new Date().toString() + '_';
		
		u = new ClientConnection();
		usrsse2 = new ClientConnection();
		return u.connect(url)
		.then(() => u.request(['login', 'u', 'p']))
		.then(() => usrsse2.connect(url))
		.then(() => usrsse2.request(['login', 'usrsse2', '123']));
	});
	
	it("notifies granted user of its rights", function() {
		u.request(['newtl', tlname])
		.then(() => u.request(['grant', tlname, 'usrsse2']))
		.then(() => usrsse2.receive().should.become({
			info: 'Now you have modification rights for tasklist ' + tlname
		}));
	});
	
	it("notifies allowed users of new tasks", function() {
		var r;
		usrsse2.request(['addtask', tlname, 'Task 1'])
		.then(() => u.receive())
		.should.become({
			info: 'usrsse2 added new task Task 1 in tasklist' + tlname
		})
		//.then(() => usrsse2.receiveUntil(x => 'info' in x))
		.then(() => usrsse2.receive())
		.then(x => {
			if ('info' in x)
				r = x;
		})
		.then(() => usrsse2.receive())
		.then(x => {
			if ('info' in x)
				r = x;
			return r;
		})
		.should.become({
			info: 'usrsse2 added new task Task 1 in tasklist' + tlname
		});
	});

	it("notifies allowed users of comments", function() {
		var r;
		usrsse2.request(['comment', tlname, 'Task 1', 'Comment'])
		.then(() => u.receive())
		.should.become({
			info: 'usrsse2 posted a new comment on task Task 1 in tasklist' + tlname
		})
		.then(() => usrsse2.receive())
		.then(x => {
			if ('info' in x)
				r = x;
		})
		.then(() => usrsse2.receive())
//		.then(() => usrsse2.receiveUntil(x => 'info' in x))
		.then(x => {
			if ('info' in x)
				r = x;
			return r;
		})
		.should.become({
			info: 'usrsse2 posted a new comment on task Task 1 in tasklist' + tlname
		});
	});
	
//			info: 'u added new task Task 1 in tasklist ' + tlname
	
	after(function() {
		return u.request(['logout'])
		.catch(() => undefined)
		.then(() => u.disconnect())
		.then(() => usrsse2.request(['logout']))
		.catch(() => undefined)
		.then(() => usrsse2.disconnect());
	});
});