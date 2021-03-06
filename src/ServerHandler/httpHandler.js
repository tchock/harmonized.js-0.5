'use strict';

define('ServerHandler/httpHandler', ['harmonizedData', 'lodash'], function(harmonizedData, _) {
  return {

    /**
     * Sets connection state to true
     * @param  {ServerHandler} serverHandler ServerHandler to set connection on
     */
    connect: function(serverHandler) {
      serverHandler._connected = true;
      serverHandler.pushAll();
    },

    /**
     * Sets connection state to false
     * @param  {ServerHandler} serverHandler ServerHandler to set connection on
     */
    disconnect: function(serverHandler) {
      serverHandler._connected = false;
    },

    /**
     * Fetches data from the server via HTTP
     * @param  {ServerHandler} serverHandler ServerHandler to set last modified
     */
    fetch: function(serverHandler, cb) {
      var httpOptions = {};

      if (_.isObject(serverHandler._options.params)) {
        httpOptions.params = serverHandler._options.params;
      }

      httpOptions.headers = _.merge({}, serverHandler._options.httpHeaders.get, serverHandler._options.httpHeaders.all);

      if (serverHandler._options.sendModifiedSince && serverHandler._lastModified > 0) {
        httpOptions.headers['If-Modified-Since'] =  serverHandler._lastModified;
      }

      httpOptions.url = serverHandler._fullUrl;
      httpOptions.method = 'GET';

      harmonizedData._httpFunction(httpOptions).then(function(response) {
        // Return last modified response
        var lastModifiedFn = serverHandler._options.hooks.getLastModified;
        if (_.isFunction(lastModifiedFn)) {
          serverHandler._lastModified = lastModifiedFn(response);
        }

        // The returned content
        var returnedItems = response.data;
        var responseLenght = returnedItems.length;

        if (_.isFunction(serverHandler._options.hooks.postFetch)) {
          serverHandler._options.hooks.postFetch(returnedItems);
        }

        // Go through all returned items
        for (var i = 0; i < responseLenght; i++) {
          var item = harmonizedData._createStreamItem(returnedItems[i], {
            serverKey: serverHandler._keys.serverKey,
          });
          item.meta.action = 'save';

          // Send item to the downstream
          serverHandler.downStream.onNext(item);
        }

        if (_.isFunction(cb)) {
          cb();
        }
      }).catch(function(error) {
        // Catch errors
        serverHandler._broadcastError(error);
      });
    },

    /**
     * Sends a request to the server
     * @param  {ServerHandler} serverHandler  The server handler to get URL
     * @param  {Request} httpOptions          The options for the request
     * @return {Promise}                      The promise of the HTTP request
     */
    sendRequest: function(httpOptions, serverHandler) {
      httpOptions.url = serverHandler._fullUrl;
      httpOptions.method = httpOptions.method || 'GET';

      return harmonizedData._httpFunction(httpOptions);
    },

    /**
     * Push item to the HTTP server
     * @param  {object} item                  item to push
     * @param  {ServerHandler} serverHandler  ServerHandler for individual options
     */
    push: function(item, serverHandler) {
      var action = item.meta.action;

      // Don't send delete request with no server ID!
      if (action === 'delete' && _.isUndefined(item.meta.serverId)) {
        return;
      }

      var httpOptions = {};

      if (_.isObject(serverHandler._options.params)) {
        httpOptions.params = serverHandler._options.params;
      }

      httpOptions.url = serverHandler._fullUrl;

      switch (action) {
        case 'save':
          httpOptions.data = serverHandler._createServerItem(item);
          if (_.isUndefined(item.meta.serverId)) {
            httpOptions.method = 'POST';
            httpOptions.headers = _.merge({}, serverHandler._options.httpHeaders.post, serverHandler._options.httpHeaders.all);
          } else {
            httpOptions.method = 'PUT';
            httpOptions.url = httpOptions.url + item.meta.serverId + '/';
            httpOptions.headers = _.merge({}, serverHandler._options.httpHeaders.put, serverHandler._options.httpHeaders.all);
          }

          break;
        case 'delete':
        case 'deletePermanently':
          httpOptions.method = 'DELETE';
          httpOptions.url = httpOptions.url + item.meta.serverId + '/';
          httpOptions.headers = _.merge({}, serverHandler._options.httpHeaders.delete, serverHandler._options.httpHeaders.all);
          break;
        case 'function':
          httpOptions.method = 'POST';
          httpOptions.headers = _.merge({}, serverHandler._options.httpHeaders.function, serverHandler._options.httpHeaders.all);
          var idPart = (_.isUndefined(item.meta.serverId)) ? '' :  item.meta.serverId + '/';
          httpOptions.url = httpOptions.url + idPart + item.data.fnName + '/';
          httpOptions.data = item.data.fnArgs;
          break;
      }

      if (_.isPlainObject(serverHandler._options.hooks) && _.isFunction(serverHandler._options.hooks.prePush)) {
        httpOptions = serverHandler._options.hooks.prePush(httpOptions, item);
      }

      harmonizedData._httpFunction(httpOptions).then(function(returnItem) {
        var tempItem = harmonizedData._createStreamItem(returnItem.data, {
          serverKey: serverHandler._keys.serverKey,
        });

        item.meta.serverId = tempItem.meta.serverId || item.meta.serverId;

        // Delete server id if not defined
        if (_.isUndefined(item.meta.serverId)) {
          delete item.meta.serverId;
        }

        if (item.meta.action === 'save' && serverHandler._options.omitItemDataOnSend) {
          item.data = returnItem.data;
          delete item.data[serverHandler._keys.serverKey];
        } else if (item.meta.action === 'delete' || item.meta.action === 'deletePermanently') {
          item.meta.action = 'deletePermanently';
          item.meta.deleted = true;
        } else if (item.meta.action === 'function') {
          item.data.fnReturn = tempItem.data;
          if (_.isPlainObject(serverHandler._options.hooks) && _.isFunction(serverHandler._options.hooks.functionReturn)) {
            item = serverHandler._options.hooks.functionReturn(item, returnItem.data);
          }
        }

        if (_.isFunction(serverHandler._options.hooks.postPush)) {
          serverHandler._options.hooks.postPush(returnItem, item);
        }

        serverHandler.downStream.onNext(item);
      }).catch(function(error) {
        serverHandler._unpushedList[item.meta.rtId] = item;
        serverHandler._broadcastError(error, item);
      });
    },
  };
});
