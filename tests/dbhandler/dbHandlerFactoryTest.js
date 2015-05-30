describe("DB Handler Factory", function() {

  function getObjectSize (object) {
    var size = 0;
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        size++;
      }
    }
    return size;
  }

  beforeEach(function() {
    // TODO create resource definition
  });

  beforeEach(function() {
    // TODO other db configuration
  });

  it('should create a IndexedDB DB Handler because IndexedbDb is supported', function(){
    // Creates spies to mock available indexeddb
    spyOn(Harmonized.dbHandlerFactory, "_getIndexedDb").and.returnValue(true);

    // Initialized db handler factory
    Harmonized.dbHandlerFactory();

    // Test for correct handler and created handler object
    expect(Harmonized.dbHandlerFactory._DbHandler).toBe(Harmonized.IndexedDbHandler);
    var handler = Harmonized.dbHandlerFactory.createDbHandler('testStore');
    expect(handler instanceof Harmonized.IndexedDbHandler).toBeTruthy();
  });

  it('should create a WebSQL DB Handler because only WebSQL is supported', function(){
    // Creates spies to mock missing indexeddb and available websql
    spyOn(Harmonized.dbHandlerFactory, "_getIndexedDb").and.returnValue(false);
    spyOn(Harmonized.dbHandlerFactory, "_getWebSql").and.returnValue(true);

    // Initialized db handler factory
    Harmonized.dbHandlerFactory();

    // Test for correct handler and created handler object
    expect(Harmonized.dbHandlerFactory._DbHandler).toBe(Harmonized.WebSqlHandler);
    var handler = Harmonized.dbHandlerFactory.createDbHandler('testStore');
    expect(handler instanceof Harmonized.WebSqlHandler).toBeTruthy();
  });

  it('should create no DB Handler because no DB is supported', function(){
    // Creates spies to mock missing indexeddb and websql
    spyOn(Harmonized.dbHandlerFactory, "_getIndexedDb").and.returnValue(false);
    spyOn(Harmonized.dbHandlerFactory, "_getWebSql").and.returnValue(false);

    // Initialized db handler factory
    Harmonized.dbHandlerFactory();

    // Test for correct handler and created handler object
    expect(Harmonized.dbHandlerFactory._DbHandler).toBeUndefined();
    var handler = Harmonized.dbHandlerFactory.createDbHandler('testStore');
    expect(handler).toBeUndefined();

  });

  it('should find the right store definitions', function() {
    var struct = Harmonized.dbHandlerFactory._getDbStructure();
    expect(localDb.getSearchProperties('testDb', 'test').length).toEqual(0);
    expect(localDb.getSearchProperties('testDb', 'newtest').length).toEqual(1);
    expect(localDb.getSearchProperties('testDb', 'othertest').length).toEqual(2);
    // TODO check if the store definitions are right
    // TODO Check if content of search properties array is correct
  });

  it  ('should get server and store key names', function(){
    // TODO check for correct server and store keys
  });

  it ('should get db version', function(done){
    // Initialized db handler factory
    Harmonized.dbHandlerFactory();

    // Initial connect
    var handler = Harmonized.dbHandlerFactory.createDbHandler('testStore');
    handler.connect();

    // TODO add event for initialized database
    // Check if version is set to 1
    expect(Harmonized.dbHandlerFactory.getDbVersion()).toBe(1);
  });

});