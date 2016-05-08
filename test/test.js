const WebSocket = require('ws');
const Promise = require('bluebird');
const ClientConnection = require('../register/html/libclient.js');
const chai = require('chai');
const assert = chai.assert;
const should = chai.should();
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);


var client;
function connect(done) {
	client = new ClientConnection();
	client.connect('ws://localhost:' + process.env.PORT)
	.then(() => done())
	.catch(done);
}

function disconnect() {
	client.disconnect();
}

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
		return client.request(['login', 'u', 'password'])
		.should.be.rejected//become({ status: 'Wrong login/password' })
		.then(() => client.request(['id']))
		.should.be.rejected//become({ status: 'Not logged in' });
	});
	
	it('can logout and login as different user', function() {
		return client.request(['login', 'u', 'p'])
		.then(() => client.request(['id']))
		.should.become({ status: 'OK', id: 'u' })
		.then(() => client.request(['logout']))
		.should.be.fulfilled
		.then(() => client.request(['id']))
		.should.be.rejected
		.then(() => client.request(['login', 'usrsse2', '123']))
		.then(() => client.request(['id']))
		.should.become({ status: 'OK', id: 'usrsse2' });
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
	
	it("doesn't allow non-owner to revoke", function() {
		return client.request(['logout'])
		.then(() => client.request(['login', 'usrsse2', '123']))
		.then(() => client.request(['revoke', tlname, 'usrsse2']))
		.should.be.rejected;
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
});