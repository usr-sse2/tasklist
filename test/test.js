const WebSocket = require('ws');
const Promise = require('bluebird');
const Client = require('../register/html/libclient.js');
const chai = require('chai');
const assert = chai.assert;
const pAsync = Promise.promisify(Client.p);
const should = chai.should();
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

function WSConnection() {
    'use strict';
    this.socket = {};
}

WSConnection.prototype.connect = function (url) {
    'use strict';

	var wsc = this;

    return new Promise((resolve, reject) => {
        wsc.socket = new WebSocket(url);
		
        wsc.socket.onopen = function () {
            resolve();
        };

        wsc.socket.onerror = function (error) {
            reject(error);
        };
    });
};


WSConnection.prototype.disconnect = function () {
    'use strict';
    this.socket.close();
};

var ws;
function connect(done) {
	ws = new WSConnection();
	ws.connect('ws://localhost:' + process.env.PORT)
	.then(() => done())
	.catch(done);
}

function disconnect() {
	ws.disconnect();
}

describe('LoginTests', function() {
	beforeEach(connect);
	afterEach(disconnect);

	it('respond with OK on correct login and password', function() {
		return pAsync(ws.socket, ['login', 'u', 'p'])
		.should.become('{"status":"OK"}')
		.then(() => pAsync(ws.socket, ['id']))
		.should.become('{"status":"OK","id":"u"}');
	});
	
	it('respond with error on incorrect login and password', function() {
		return pAsync(ws.socket, ['login', 'u', 'password'])
		.should.become('{"status":"Wrong login/password"}')
		.then(() => pAsync(ws.socket, ['id']))
		.should.become('{"status":"Not logged in"}');
	})	
});


function connectAndLogin(done) {
	ws = new WSConnection();
	ws.connect('ws://localhost:' + process.env.PORT)
	.then(() => pAsync(ws.socket, ['login', 'u', 'p']))
	.then(() => done())
	.catch(done);	
}

describe('TasklistTests', function() {
	before(connectAndLogin);
	after(disconnect);
	
	var tlname;
	
	it('successfully creates tasklist', function() {
		// tlname = '     __test_tasklist' + new Date().toString();
// 		return pAsync(ws.socket, ['newtl', tlname])
// 		.should.become('{"status":"OK"}')
// 		.then(() => pAsync(ws.socket, ['getall'])
//.should.eventually.contain()
	});
});