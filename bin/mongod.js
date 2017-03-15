/**
 * Created by cn40580 on 2017-03-15.
 */

var MongoClient = require('mongodb').MongoClient;
var Q = require('q');

exports.findAllBusRoute = function() {
    var deferred = Q.defer();
    MongoClient.connect('mongodb://localhost:27017/test', function(err, db) {
        var collection = db.collection('busRouteDTO');
        var whereStr = {};
        var queryResult = [];
        collection.find(whereStr,function(error, cursor){
            cursor.each(function(error,doc) {
                if (doc) {
                    queryResult.push(doc);
                }
                deferred.resolve(queryResult);
            });
        });
        db.close();
    });
    return deferred.promise;
};