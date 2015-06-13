'use strict';

describe('ServerHandler', function() {
  var ServerHandler = Harmonized.ServerHandler;
  var sh;
  var scheduler;

  beforeEach(function() {
    // Scheduler to mock the RxJS timing
    scheduler = new Rx.TestScheduler();

    // Mock the subject to let it use the scheduler
    var OriginalSubject = Rx.Subject;
    spyOn(Rx, 'Subject').and.callFake(function() {
      return new OriginalSubject(scheduler.createObserver(), scheduler.createHotObservable());
    });
  });

  beforeEach(function() {
    spyOn(ServerHandler.prototype, '_setProtocol').and.callThrough();
    spyOn(ServerHandler.httpHandler, 'connect').and.stub();
    spyOn(ServerHandler.httpHandler, 'disconnect').and.stub();
    spyOn(ServerHandler.httpHandler, 'fetch').and.stub();
    spyOn(ServerHandler.httpHandler, 'push').and.stub();
    spyOn(ServerHandler.socketHandler, 'connect').and.stub();
    spyOn(ServerHandler.socketHandler, 'disconnect').and.stub();

    ServerHandler.connectionStream = new Rx.Subject();
    sh = new ServerHandler('http://api.hyphe.me/', 'rest/resource/', {});
  });

  describe('connection', function() {

    xit('should set connection state to true', function() {
      spyOn(sh, 'pushAll').and.stub();
      expect(sh._connected).toBeFalsy();
      expect(sh.pushAll).not.toHaveBeenCalled();
      sh.setConnectionState(true);
      expect(sh._connected).toBeTruthy();
      expect(sh.pushAll).toHaveBeenCalled();
    });

    xit('should set connection state to false', function() {
      sh._connected = true;
      spyOn(sh, 'pushAll').and.stub();
      expect(sh._connected).toBeTruthy();
      expect(sh.pushAll).not.toHaveBeenCalled();
      sh.setConnectionState(true);
      expect(sh._connected).toBeFalsy();
      expect(sh.pushAll).not.toHaveBeenCalled();
    });

  });

  describe('streams', function() {

    xit('should push items to a not connected stream and put them to the unpushedList', function() {
      sh._connected = false;
      var pushList = [];

      sh.upStream.subscribe(function(item) {
        pushList.push(item);
      });

      scheduler.scheduleWithAbsolute(1, function() {
        sh.upStream.onNext({
          data: {
            name: 'Frank Underwood'
          },
          meta: {
            rtId: 152
          }
        });
        sh.upStream.onNext({
          data: {
            name: 'Walter White'
          },
          meta: {
            rtId: 415
          }
        });
      });

      scheduler.scheduleWithAbsolute(10, function() {
        sh.upStream.onNext({
          data: {
            name: 'Don Draper'
          },
          meta: {
            rtId: 387
          }
        });
        sh.upStream.onNext({
          data: {
            name: 'Jack Sheppard'
          },
          meta: {
            rtId: 18
          }
        });
      });

      scheduler.start();

      expect(sh._unpushedList).toHaveMember(152);
      expect(sh._unpushedList).toHaveMember(415);
      expect(sh._unpushedList).toHaveMember(387);
      expect(sh._unpushedList).toHaveMember(18);

      expect(ServerHandler.httpHandler.push).not.toHaveBeenCalled();
    });

    xit('should push items to a connected stream and call the push method of the implementation', function() {
      sh._connected = false;
      var pushList = [];

      spyOn(ServerHandler.httpHandler, 'push').and.callFake(function(item, handler) {
        pushList.push(item);
      });

      scheduler.scheduleWithAbsolute(1, function() {
        sh.upStream.onNext({
          data: {
            name: 'Frank Underwood'
          },
          meta: {
            rtId: 152
          }
        });
        sh.upStream.onNext({
          data: {
            name: 'Walter White'
          },
          meta: {
            rtId: 415
          }
        });
      });

      scheduler.scheduleWithAbsolute(10, function() {
        sh.upStream.onNext({
          data: {
            name: 'Don Draper'
          },
          meta: {
            rtId: 387
          }
        });
        sh.upStream.onNext({
          data: {
            name: 'Jack Sheppard'
          },
          meta: {
            rtId: 18
          }
        });
      });

      scheduler.start();

      expect(sh._unpushedList).not.toHaveMember(152);
      expect(sh._unpushedList).not.toHaveMember(415);
      expect(sh._unpushedList).not.toHaveMember(387);
      expect(sh._unpushedList).not.toHaveMember(18);

      expect(ServerHandler.httpHandler.push.calls.count()).toBe(4);
      expect(pushList[0].meta.rtId).toBe(152);
      expect(pushList[1].meta.rtId).toBe(415);
      expect(pushList[2].meta.rtId).toBe(387);
      expect(pushList[3].meta.rtId).toBe(18);
    });

    xit('should set the connection state through the global stream', function() {
      var stateList = [];
      var connectionState = false;

      spyOn(sh, 'setConnectionState').and.callFake(function(state) {
        connectionState = state;
      });

      sh.connectionStream.subscribe(function(state) {
        stateList.push(state);
      });

      scheduler.scheduleWithAbsolute(5, function() {
        ServerHandler.connectionStream.onNext(true);
      });

      scheduler.scheduleWithAbsolute(10, function() {
        ServerHandler.connectionStream.onNext(false);
      });

      scheduler.scheduleWithAbsolute(15, function() {
        ServerHandler.connectionStream.onNext(true);
      });

      expect(connectionState).toBeFalsy();

      scheduler.start();

      expect(stateList).toEqual([true, false, true]);
      expect(connectionState).toBeTruthy();
    });

    xit('should set the connection state through the connection stream of the handler instance', function() {
      var stateList = [];
      var connectionState = false;

      spyOn(sh, 'setConnectionState').and.callFake(function(state) {
        connectionState = state;
      });

      sh.connectionStream.subscribe(function(state) {
        stateList.push(state);
      });

      scheduler.scheduleWithAbsolute(5, function() {
        sh.connectionStream.onNext(true);
      });

      scheduler.scheduleWithAbsolute(10, function() {
        sh.connectionStream.onNext(false);
      });

      scheduler.scheduleWithAbsolute(15, function() {
        sh.connectionStream.onNext(true);
      });

      expect(connectionState).toBeFalsy();

      scheduler.start();

      expect(stateList).toEqual([true, false, true]);
      expect(connectionState).toBeTruthy();
    });

  });

  describe('protocol', function() {

    xit('should be set to http on handler creation', function() {
      expect(ServerHandler.prototype._setProtocol).toHaveBeenCalled();
      expect(ServerHandler.httpHandler.connect).toHaveBeenCalled();
      expect(ServerHandler._protocol).toBe(ServerHandler.httpHandler);
    });

    xit('should be set to websocket on handler creation', function() {
      sh = new ServerHandler('http://api.hyphe.me/', 'rest/resource/', {
        protocol: 'websocket'
      });
      expect(ServerHandler.prototype._setProtocol).toHaveBeenCalled();
      expect(ServerHandler.socketHandler.connect).toHaveBeenCalled();
      expect(ServerHandler._protocol).toBe(ServerHandler.socketHandler);
    });

    xit('should be set to http from http', function() {
      sh._protocol = ServerHandler.httpHandler;
      expect(ServerHandler.httpHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.httpHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler._protocol).toBe(ServerHandler.httpHandler);

      sh._setProtocol('http');

      expect(ServerHandler.httpHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.httpHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler.websocketHandler.connect.calls.count()).toBe(0);
      expect(ServerHandler.websocketHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler._protocol).toBe(ServerHandler.httpHandler);
    });

    xit('should be set to websocket from http', function() {
      sh._protocol = ServerHandler.httpHandler;
      expect(ServerHandler.httpHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.httpHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler.websocketHandler.connect.calls.count()).toBe(0);
      expect(ServerHandler.websocketHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler._protocol).toBe(ServerHandler.httpHandler);

      sh._setProtocol('websocket');

      expect(ServerHandler.httpHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.httpHandler.disconnect.calls.count()).toBe(1);
      expect(ServerHandler.websocketHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.websocketHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler._protocol).toBe(ServerHandler.socketHandler);
    });

    xit('should be set to http from websocket', function() {
      sh._protocol = ServerHandler.socketHandler;
      expect(ServerHandler.httpHandler.connect.calls.count()).toBe(0);
      expect(ServerHandler.httpHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler.websocketHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.websocketHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler._protocol).toBe(ServerHandler.socketHandler);

      sh._setProtocol('http');

      expect(ServerHandler.httpHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.httpHandler.disconnect.calls.count()).toBe(0);
      expect(ServerHandler.websocketHandler.connect.calls.count()).toBe(1);
      expect(ServerHandler.websocketHandler.disconnect.calls.count()).toBe(1);
      expect(ServerHandler._protocol).toBe(ServerHandler.httpHandler);
    });

  });

  describe('data', function() {

    xit('should be fetched by the protocolHandler', function() {
      sh._protocol = ServerHandler.httpHandler;
      expect(ServerHandler.httpHandler.fetch.calls.count()).toBe(0);
      sh.fetch();
      expect(ServerHandler.httpHandler.fetch.calls.count()).toBe(1);
    });

    xit('should be pushed by pushAll function', function() {
      var pushList = [];

      sh._unpushedList = {
        123: {
          firstName: 'Hans',
          lastName: 'Wurst'
        },
        315: {
          firstName: 'Peter',
          lastName: 'Silie'
        },
        483: {
          firstName: 'Kurt',
          lastName: 'Zehose'
        }
      };

      sh.upStream.subscribe(function(item) {
        pushList.push(item);
      });

      scheduler.scheduleWithAbsolute(1, function() {
        sh.pushAll();
      });

      scheduler.start();

      expect(pushList).toBeArrayOfSize(3);
      expect(pushList[0].firstName).toBe('Hans');
      expect(pushList[1].firstName).toBe('Peter');
      expect(pushList[2].firstName).toBe('Kurt');

      expect(sh._unpushedList).toBeEmptyObject();

    });

    xit('should create create a server item with full metadata', function() {
      var inputItem = {
        data: {
          firstName: 'John',
          lastName: 'Doe'
        },
        meta: {
          storeId: 123,
          serverId: 321
        }
      };

      var expectedOutputItem = _.clone(inputItem.data);
      expectedOutputItem.id = 321;
      var outputItem = sh._createServerItem(inputItem);

      expect(outputItem).toEqual(expectedOutputItem);
      expect(outputItem).not.toEqual(inputItem.data);
      expect(outputItem).not.toBe(inputItem.data);
    });

    xit('should create create a server item with one missing metadata', function() {
      var inputItem = {
        data: {
          firstName: 'John',
          lastName: 'Doe'
        },
        meta: {
          serverId: 321
        }
      };

      var expectedOutputItem = _.clone(inputItem.data);
      expectedOutputItem.id = 321;

      var outputItem = sh._createServerItem(inputItem);
      expect(outputItem).toEqual(expectedOutputItem);
      expect(outputItem).not.toEqual(inputItem.data);
      expect(outputItem).not.toBe(inputItem.data);
    });

    xit('should create create a server item with whole missing metadata', function() {
      var inputItem = {
        data: {
          firstName: 'John',
          lastName: 'Doe'
        }
      };

      var expectedOutputItem = _.clone(inputItem.data);

      var outputItem = sh._createServerItem(inputItem);
      expect(outputItem).toEqual(expectedOutputItem);
      expect(outputItem).toEqual(inputItem.data);
      expect(outputItem).not.toBe(inputItem.data);
    });
  });

});