'use strict';

define('ViewCollection', ['harmonizedData', 'ServerHandler', 'ViewItem', 'rx', 'lodash'], function(harmonizedData, ServerHandler, ViewItem, Rx, _) {

  /**
   * The ViewCollection constructor
   * @param {Model} model         The model of the view collection
   * @param {Function} mapDownFn  Function to change data to the view format
   * @param {Function} mapUpFn    Function to change data to the model format
   */
  var ViewCollection = function ViewCollection(model, mapDownFn, mapUpFn) {
    // Make the collection act as an array
    var collection = Object.create(Array.prototype);
    collection = Array.apply(collection);

    function s4() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }

    collection._uid = s4() + s4() + s4();
    collection._version = 0;
    collection._model = model;
    collection._items = {};

    // Set the map functions to the ones in the parameter or to default
    collection._mapDownFn = mapDownFn || function(item) {
      return item;
    };

    collection._mapUpFn = mapUpFn || function(item) {
      return item;
    };

    // map the downstream to show the data as the view needs it
    collection.downStream = model.downStream.filter(function(item) {
      // Don't let returning function in the downstream
      return item.meta.action !== 'function';
    }).map(function(item) {
      var newItem = _.cloneDeep(item);
      newItem.data = collection._mapDownFn(newItem.data);
      return newItem;
    });

    // Filters items that are not in the view model yet
    collection.downStream.filter(function(item) {
      return _.isUndefined(collection._items[item.meta.rtId]) && !item.meta.deleted;
    }).subscribe(function(item) {
      var subData = collection._model._rtIdHash[item.meta.rtId].subData;
      new ViewItem(collection, item.data, item.meta, subData, true);
    });

    // map the upstream to transform the data to the model format
    collection.upStream = new Rx.Subject();
    collection.upStream.map(function(item) {
      var newItem = _.cloneDeep(item);
      newItem.data = collection._mapUpFn(newItem.data);
      return newItem;
    }).subscribe(model.upStream);

    collection.functionReturnStream = model.downStream.filter(function(item) {
      return item.meta.action === 'function';
    });

    collection.incrementVersion = function() {
      collection._version++;
    };

    collection.checkForDeletedItems = function() {
      collection._model.checkForDeletedItems();
    };

    // Inject all items of the ViewController prototype to the created instance
    ViewCollection.injectClassMethods(collection);

    // Get all model items
    model.getItems(function(item) {
      new ViewItem(collection, item.data, item.meta, null, true);
    });

    return collection;
  };

  /**
   * Injects all items from the prototype to the created view collection
   * @param  {Object} collection The collection to add the methods to
   * @return {Object}            The collection with the added methods
   */
  ViewCollection.injectClassMethods = function injectClassMethods(
    collection) {
    // Loop over all the prototype methods and add them
    // to the new collection.
    for (var method in ViewCollection.prototype) {
      // Make sure this is a local method.
      /* istanbul ignore else */
      if (ViewCollection.prototype.hasOwnProperty(method)) {
        // Add the method to the collection.
        collection[method] = ViewCollection.prototype[method];
      }
    }

    return collection;
  };

  /**
   * Adds a new item from the model to the view model
   * @param  {number}   rtId The runtime ID of the item to add
   * @return {ViewItem}      The added view item
   */
  ViewCollection.prototype.addItem = function(rtId) {
    var itemToAdd = this._model.getItem(rtId);
    var newViewItem;
    if (!_.isUndefined(itemToAdd)) {
      var data = this._mapDownFn(_.cloneDeep(itemToAdd.data));
      newViewItem = new ViewItem(this, data, _.cloneDeep(itemToAdd.meta), itemToAdd.subData, true);
    }

    return newViewItem;
  };

  /**
   * Gets data from the server
   */
  ViewCollection.prototype.fetch = function(cb) {
    this._model.getFromServer(cb);
  };

  /**
   * Creates a new view item with reference to the collection
   * @return {ViewItem} The created view item
   */
  ViewCollection.prototype.new = function(addToCollection) {
    var add = addToCollection || false;
    return new ViewItem(this, {}, {}, null, add);
  };

  ViewCollection.prototype.callFn = function(name, args) {
    var transactionId = harmonizedData.getNextTransactionId();
    var deferred;
    var Promise = harmonizedData._promiseClass;
    /* istanbul ignore else */
    if (Promise !== null) {
      deferred = Promise.defer();

      var successSub;
      var errorSub;
      successSub = this.functionReturnStream.filter(function(item) {
        return item.meta.transactionId === transactionId;
      }).subscribe(function(item) {
        deferred.resolve(item);
        successSub.dispose();
        errorSub.dispose();
      });

      errorSub = ServerHandler.errorStream.filter(function(error) {
        return error.target.transactionId === transactionId;
      }).subscribe(function(error) {
        if (error.target.status === -1) {
          deferred.notify();
        } else {
          deferred.reject(error);
          successSub.dispose();
          errorSub.dispose();
        }
      });
    }

    this.upStream.onNext({
      meta: {
        action: 'function',
        transactionId: transactionId,
      },
      data: {
        fnName: name,
        fnArgs: args
      }
    });

    if (deferred) {
      return deferred.promise;
    }
  };

  return ViewCollection;
});
