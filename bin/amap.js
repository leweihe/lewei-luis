var http = require('http');
var qs = require('querystring');
var Q = require('q');
var MongoClient = require('mongodb').MongoClient;

var findAllBusRoute = function() {
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

exports.getAmapCard = function (session, builder, dest) {
    var result = [];
    var deferred = Q.defer();
    findAllBusRoute().then(function(busRoutes){
        var queryPoint = session.userData.possiblePoints[0];
        var busRoute = calcBusRoute(queryPoint, busRoutes);

        result.push(new builder.HeroCard(session)
            .title('去[' + dest.entity + ']的最佳路线为[' + busRoute.routeName + ']路班车')
            .subtitle('建议选在[' + dest.entity + '] 下车')
            // .text('建议您乘坐XXX路班车')
            // .images([
            //     builder.CardImage.create(session, 'https://docs.microsoft.com/en-us/azure/storage/media/storage-introduction/storage-concepts.png')
            // ])
            .buttons([
                builder.CardAction.openUrl(session, 'https://azure.microsoft.com/en-us/services/storage/', '查看路线')
            ]));
        deferred.resolve(result);
    });
    return deferred.promise;
};

var calcBusRoute = function(queryPoint, busRoutes) {
    return busRoutes[0];
};

exports.searchInAmap = function(dests) {
    var deferred = Q.defer();
    //读取文件
    var keywords = '';
    dests.forEach(function (dest) {
        keywords += dest.entity + '|';
    });
    var apiData = {
        key: '06268f43b75ea67cbe6faa132acc4d19',
        city: '厦门',
        extensions: 'base',
        keywords: keywords,
        offset: 3, //选五个
        page: 1
    };
    var content = qs.stringify(apiData);
    var options = {
        hostname: 'restapi.amap.com',
        path: '/v3/place/text?' + content,
        method: 'GET'
    };
    var result = [];
    var req = http.request(options, function (res) {
        var responseText='';
        res.on('data', function (data) {
            responseText += data;
        });
        res.on('end', function () {
            JSON.parse(responseText).pois.forEach(function(point) {
                result.push(point)
            });
            deferred.resolve(result);
        });

    });
    req.on('error', function (e) {
        console.log('problem with request: ' + e.message);
    });
    req.end();

    return deferred.promise;
};