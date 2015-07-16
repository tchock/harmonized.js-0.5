'use strict';

define(['Squire', 'sinon', 'lodash', 'rx', 'rx.testing'],
  function(Squire, sinon, _, Rx, RxTest) {
    describe('Model', function() {

      var testModel;
      var expectedOptions;
      var injector;
      var scheduler;

      var dbHandlerUpstreamList = [];
      var serverHandlerUpstreamList = [];

      var dbHandlerUpstream;
      var dbHandlerDownstream;

      var serverHandlerUpstream;
      var serverHandlerDownstream;

      var ModelItemMock = function ModelItemMock(model, data, meta) {
        this.getModel = function() {
          return model;
        };

        this.data = data || {};
        this.meta = meta || {};

        this.meta.rtId = this.meta.rtId || this.getModel().getNextRuntimeId();

        this.getModel()._rtIdHash[this.meta.rtId] = this;

        if (!_.isUndefined(this.meta.serverId)) {
          this.getModel()._serverIdHash[this.meta.serverId] = this;
        }

        if (!_.isUndefined(this.meta.storeId)) {
          this.getModel()._storeIdHash[this.meta.storeId] = this;
        }

      };

      var ServerHandlerMock = function ServerHandlerMock(baseUrl,
        route, options) {

        serverHandlerUpstream = new Rx.Subject();
        serverHandlerUpstream.subscribe(function(item) {
          serverHandlerUpstreamList.push(item);
        });

        serverHandlerDownstream = new Rx.Subject();

        this._baseUrl = baseUrl;
        this._route = route;
        this._options = options;

        this.upStream = serverHandlerUpstream;
        this.downStream = serverHandlerDownstream;
        this.fetch = jasmine.createSpy();
      };

      var dbHandlerFactoryMock = {};
      dbHandlerFactoryMock.createDbHandler = function createDbHandler(storeName,
        keys) {

        dbHandlerUpstream = new Rx.Subject();
        dbHandlerUpstream.subscribe(function(item) {
          dbHandlerUpstreamList.push(item);
        });

        dbHandlerDownstream = new Rx.Subject();

        return {
          _storeName: storeName,
          _keys: keys,
          upStream: dbHandlerUpstream,
          downStream: dbHandlerDownstream
        };
      };

      var harmonizedDataMock = {
        _modelSchema: {
          test: {
            storeName: 'test',
            baseUrl: 'http://www.testserver.de/',
            route: 'test',
            keys: {
              serverKey: 'id',
              storeKey: '_id'
            }
          },
          explicitTest: {
            storeName: 'test',
            baseUrl: 'http://www.testserver.de/',
            route: 'test',
            keys: {
              serverKey: 'id',
              storeKey: '_id'
            }
          }
        }
      };

      beforeEach(function() {
        // Scheduler to mock the RxJS timing
        scheduler = new RxTest.TestScheduler();

        dbHandlerUpstreamList = [];
        serverHandlerUpstreamList = [];
      });

      beforeEach(function() {
        expectedOptions = {
          baseUrl: 'http://www.testserver.de/',
          route: 'test',
          keys: {
            serverKey: 'id',
            storeKey: '_id'
          },
          storeName: 'test',
          serverOptions: {}
        };
      });

      beforeEach(function() {
        injector = new Squire();
        injector.mock('ModelItem', ModelItemMock);
        injector.mock('dbHandlerFactory', dbHandlerFactoryMock);
        injector.mock('ServerHandler', ServerHandlerMock);
        injector.mock('harmonizedData', harmonizedDataMock);
      });

      function testInContext(cb, options) {
        injector.require(['Model', 'mocks'], function(Model, mocks) {

          testModel = new Model('test');

          cb({
            Model: Model,
            mocks: mocks.mocks
          });
        });
      }

      it('should create a model without options', function(done) {
        testInContext(function(deps) {
          testModel = new deps.Model('explicitTest');
          expect(testModel._options).toEqual(expectedOptions);

          /*expect(testModel.downStream instanceof Rx.Subject).toBeTruthy();
          expect(testModel.upStream instanceof Rx.Subject).toBeTruthy();*/
          done();
        });
      });

      it('should create a model with options', function(done) {
        testInContext(function(deps) {
          testModel = new deps.Model('explicitTest', {
            route: 'othertest',
            testOption: 'blub'
          });
          var overwrittenExpectedOptions = _.clone(expectedOptions);
          overwrittenExpectedOptions.route = 'othertest';
          overwrittenExpectedOptions.testOption = 'blub';
          expect(testModel._options).toEqual(overwrittenExpectedOptions);
          done();
        });
      });

      it('should get all items', function(done) {
        testInContext(function(deps) {
          new ModelItemMock(testModel, {name: 'Horst'}, {rtId: 123});
          new ModelItemMock(testModel, {name: 'Hans'}, {rtId: 263});
          new ModelItemMock(testModel, {name: 'Dieter'}, {rtId: 469});

          var returnedItems = [];

          testModel.getItems(function(item) {
            returnedItems.push(item);
          });

          var expectedItems = [{
            name: 'Horst'
          }, {
            name: 'Hans'
          }, {
            name: 'Dieter'
          }];

          var i;

          for (i = 0; i < expectedItems.length; i++) {
            expect(returnedItems[i]).not.toBeUndefined();
            expect(returnedItems[i].data).toEqual(expectedItems[i]);
          }

          expect(i).toBe(expectedItems.length);

          done();
        });
      });

      it('should get a specific item', function(done) {
        testInContext(function(deps) {
          testModel._rtIdHash[123] = new ModelItemMock(testModel, {
            name: 'Horst'
          });
          testModel._rtIdHash[263] = new ModelItemMock(testModel, {
            name: 'Hans'
          });
          testModel._rtIdHash[469] = new ModelItemMock(testModel, {
            name: 'Dieter'
          });

          var returnedItem = testModel.getItem(263);

          expect(returnedItem).not.toBeUndefined();
          expect(returnedItem.data).toEqual({
            name: 'Hans'
          });

          // Item 1026 should not be there
          returnedItem = testModel.getItem(1026);
          expect(returnedItem).toBeUndefined();

          done();
        });
      });

      it('should get data from the server', function(done) {
        testInContext(function(deps) {
          testModel.getFromServer();

          expect(testModel._serverHandler.fetch.calls.count()).toBe(1);

          done();
        });
      });

      it('should get the next runtime id for the model', function(done) {
        testInContext(function(deps) {
          expect(testModel._nextRuntimeId).toBe(1);
          testModel.getNextRuntimeId();
          expect(testModel._nextRuntimeId).toBe(2);

          done();
        });
      });

      it('should receive updated data from the server', function(done) {
        testInContext(function(deps) {

          var existingItem = new ModelItemMock(testModel, {
            name: 'John Cleese'
          }, {
            storeId: 12,
            rtId: 12
          });

          new ModelItemMock(testModel, {
            name: 'Terry Gilliam'
          }, {
            serverId: 1025,
            storeId: 13
          });

          // Add first entry to the server downstream
          scheduler.scheduleWithAbsolute(1, function() {

            testModel._serverHandler.downStream.onNext({
              meta: {
                serverId: 1000,
                storeId: 12,
                rtId: 12
              },
              data: {
                name: 'John Cleese'
              }
            });

          });

          // Add second entry to the server downstream
          scheduler.scheduleWithAbsolute(10, function() {
            testModel._serverHandler.downStream.onNext({
              meta: {
                serverId: 1025,
                storeId: 13
              },
              data: {
                name: 'Terry Gilliam'
              }
            });
          });

          scheduler.start();

          var john = {name: 'John Cleese'};

          expect(testModel._serverIdHash[1000]).toBe(existingItem);
          expect(testModel._serverIdHash[1000].data).toEqual(john);
          expect(testModel._storeIdHash[12]).toBe(existingItem);
          expect(testModel._storeIdHash[12].data).toEqual(john);
          expect(testModel._rtIdHash[12]).toBe(existingItem);
          expect(testModel._rtIdHash[12].data).toEqual(john);

          var terry = {name: 'Terry Gilliam'};
          var terryMeta = {
            serverId: 1025,
            storeId: 13,
            rtId: 1
          };

          // Check terry to be correctly saved
          expect(testModel._serverIdHash[1025] instanceof ModelItemMock).toBeTruthy();
          expect(testModel._serverIdHash[1025].data).toEqual(terry);
          expect(testModel._serverIdHash[1025].meta).toEqual(terryMeta);

          // If rtId hash item 13 is the same as serverId hash item 1025 and
          // storeId hash item 13, then serverId item and storeId item are also
          // the same!
          expect(testModel._rtIdHash[1]).toBe(testModel._serverIdHash[1025]);
          expect(testModel._rtIdHash[1]).toBe(testModel._storeIdHash[13]);

          // Check if data are passed to the database upstream
          expect(dbHandlerUpstreamList.length).toEqual(2);
          expect(dbHandlerUpstreamList[0].data).toEqual(john);
          expect(dbHandlerUpstreamList[0].meta).toEqual({
            serverId: 1000,
            storeId: 12,
            rtId: 12
          });
          expect(dbHandlerUpstreamList[1].data).toEqual(terry);
          expect(dbHandlerUpstreamList[1].meta).toEqual(terryMeta);

          done();
        });
      });

      it('should receive new data from the server', function(done) {
        testInContext(function(deps) {

          // Add first entry to the server downstream
          scheduler.scheduleWithAbsolute(1, function() {
            testModel._serverHandler.downStream.onNext({
              meta: {
                serverId: 1000
              },
              data: {
                name: 'John Cleese'
              }
            });
          });

          // Add second entry to the server downstream
          scheduler.scheduleWithAbsolute(10, function() {
            testModel._serverHandler.downStream.onNext({
              meta: {
                serverId: 1025
              },
              data: {
                name: 'Terry Gilliam'
              }
            });
          });

          scheduler.start();

          expect(_.size(testModel._storeIdHash)).toBe(0);
          expect(_.size(testModel._rtIdHash)).toBe(2);

          var john = {name: 'John Cleese'};
          expect(testModel._serverIdHash[1000].data).toEqual(john);
          expect(testModel._serverIdHash[1000].meta).toEqual({
            serverId: 1000,
            rtId: 1
          });

          var terry = {name: 'Terry Gilliam'};
          var terryMeta = {
            serverId: 1025,
            rtId: 2
          };

          // Check terry to be correctly saved
          expect(testModel._serverIdHash[1025] instanceof ModelItemMock).toBeTruthy();
          expect(testModel._serverIdHash[1025].data).toEqual(terry);
          expect(testModel._serverIdHash[1025].meta).toEqual(terryMeta);

          // Check if data are passed to the database upstream
          expect(serverHandlerUpstreamList.length).toEqual(2);
          expect(dbHandlerUpstreamList.length).toEqual(2);
          expect(dbHandlerUpstreamList[0].data).toEqual(john);
          expect(dbHandlerUpstreamList[0].meta).toEqual({
            serverId: 1000,
            rtId: 1
          });
          expect(dbHandlerUpstreamList[1].data).toEqual(terry);
          expect(dbHandlerUpstreamList[1].meta).toEqual(terryMeta);

          expect(dbHandlerUpstreamList).toEqual(serverHandlerUpstreamList);

          done();
        });
      });

      it('should receive updated data from the database', function(done) {
        testInContext(function(deps) {
          var existingItem = new ModelItemMock(testModel, {
            name: 'John Cleese'
          }, {
            serverId: 1000,
            storeId: 12,
            rtId: 12
          });

          new ModelItemMock(testModel, {
            name: 'Terry Gilliam'
          }, {
            serverId: 1025,
            rtId: 13
          });

          // Add first entry to the server downstream
          scheduler.scheduleWithAbsolute(1, function() {
            testModel._dbHandler.downStream.onNext({
              meta: {
                serverId: 1000,
                storeId: 12,
                rtId: 12
              },
              data: {
                name: 'John Cleese'
              }
            });
          });

          // Add second entry to the server downstream
          scheduler.scheduleWithAbsolute(10, function() {
            testModel._dbHandler.downStream.onNext({
              meta: {
                serverId: 1025,
                storeId: 13,
                rtId: 13
              },
              data: {
                name: 'Terry Gilliam'
              }
            });
          });

          scheduler.start();

          var john = {name: 'John Cleese'};
          expect(testModel._serverIdHash[1000]).toBe(existingItem);
          expect(testModel._serverIdHash[1000].data).toEqual(john);
          expect(testModel._storeIdHash[12]).toBe(existingItem);
          expect(testModel._storeIdHash[12].data).toEqual(john);
          expect(testModel._rtIdHash[12]).toBe(existingItem);
          expect(testModel._rtIdHash[12].data).toEqual(john);

          var terry = {name: 'Terry Gilliam'};
          var terryMeta = {
            serverId: 1025,
            storeId: 13,
            rtId: 13
          };

          // Check terry to be correctly saved
          expect(testModel._serverIdHash[1025] instanceof ModelItemMock).toBeTruthy();
          expect(testModel._serverIdHash[1025].data).toEqual(terry);
          expect(testModel._serverIdHash[1025].meta).toEqual(terryMeta);

          // If rtId hash item 13 is the same as serverId hash item 1025 and
          // storeId hash item 13, then serverId item and storeId item are also
          // the same!
          expect(testModel._rtIdHash[13]).toBe(testModel._serverIdHash[1025]);
          expect(testModel._rtIdHash[13]).toBe(testModel._storeIdHash[13]);

          // Check if data are passed to the database upstream
          expect(dbHandlerUpstreamList.length).toEqual(0);
          expect(serverHandlerUpstreamList.length).toEqual(0);

          done();
        });
      });

      it('should receive new data from the database', function(done) {
        testInContext(function(deps) {

          // Add first entry to the server downstream
          scheduler.scheduleWithAbsolute(1, function() {
            testModel._dbHandler.downStream.onNext({
              meta: {
                storeId: 1
              },
              data: {
                name: 'John Cleese'
              }
            });
          });

          // Add second entry to the server downstream
          scheduler.scheduleWithAbsolute(10, function() {
            testModel._dbHandler.downStream.onNext({
              meta: {
                storeId: 2
              },
              data: {
                name: 'Terry Gilliam'
              }
            });
          });

          scheduler.start();

          expect(_.size(testModel._storeIdHash)).toBe(2);
          expect(_.size(testModel._rtIdHash)).toBe(2);

          var john = {name: 'John Cleese'};
          expect(testModel._storeIdHash[1].data).toEqual(john);
          expect(testModel._storeIdHash[1].meta).toEqual({
            storeId: 1,
            rtId: 1
          });

          var terry = {name: 'Terry Gilliam'};
          var terryMeta = {
            storeId: 2,
            rtId: 2
          };

          // Check terry to be correctly saved
          expect(testModel._storeIdHash[2] instanceof ModelItemMock).toBeTruthy();
          expect(testModel._storeIdHash[2].data).toEqual(terry);
          expect(testModel._storeIdHash[2].meta).toEqual(terryMeta);

          // Check if data are passed to the database upstream
          expect(dbHandlerUpstreamList.length).toEqual(2);
          expect(serverHandlerUpstreamList.length).toEqual(2);
          expect(serverHandlerUpstreamList[0].data).toEqual(john);
          expect(serverHandlerUpstreamList[0].meta).toEqual({
            storeId: 1,
            rtId: 1
          });
          expect(serverHandlerUpstreamList[1].data).toEqual(terry);
          expect(serverHandlerUpstreamList[1].meta).toEqual(terryMeta);

          expect(dbHandlerUpstreamList).toEqual(serverHandlerUpstreamList);

          done();
        });
      });

      it('should get the itemUrl with serverId given', function(done) {
        testInContext(function(deps) {
          var modelUrl = testModel.getUrl();
          expect(modelUrl).toBe('http://www.testserver.de/test');

          done();
        });
      });

    });
  });
