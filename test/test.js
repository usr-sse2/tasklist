const WebSocket = require('ws');
const Promise = require('bluebird');
const Client = require('../register/html/libclient.js');
const chai = require('chai');
const assert = chai.assert;
const pAsync = Promise.promisify(Client.p);
const should = chai.should();
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);


function checkstatus(desired) {
	return function(message) {
		var msg = JSON.parse(message);
		if (msg.status != desired)
			throw message;
	}
}


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

describe('LoginTests', function() {
	var ws;
	
	beforeEach(function(done) {
		ws = new WSConnection();
		ws.connect('ws://localhost:' + process.env.PORT)
		.then(done)
		.catch(done);
		 //ws.should.eventually;		
		 //console.log(ws);
	});
	

	it('respond with OK on correct login and password', function() {
		return pAsync(ws.socket, ['login', 'u', 'p'])
		.should.become(JSON.stringify({ status: 'OK' }));
	});
	
	it('respond with error on incorrect login and password', function() {
		return pAsync(ws.socket, ['login', 'u', 'password'])
		.should.become(JSON.stringify({ status: 'Wrong login/password' }));
	})
	
	afterEach(function() {
		ws.disconnect();
	});
});