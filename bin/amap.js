// This loads the environment variables from the .env file
require('dotenv-extended').load({
    errorOnMissing: true
});

var http = require('http');
var qs = require('querystring');
var Q = require('q');
var mongod = require('./mongod.js');

var AMAP_WEB_API_KEY = '06268f43b75ea67cbe6faa132acc4d19';
exports.getAmapCard = function (session, builder, dest) {
    var result = [];
    var deferred = Q.defer();
    mongod.findAllBusRoute().then(function (busRoutes) {
        var queryPoint = session.userData.possiblePoints[dest.index];
        calcBusRoute(queryPoint, busRoutes).then(function (nearestStation) {
            var chosenOne = {};
            busRoutes.forEach(function (route) {
                route.stations.forEach(function (station) {
                    if (station === nearestStation) {
                        chosenOne = route;
                    }
                });
            });
            result.push(new builder.HeroCard(session)
                .title('去[' + dest.entity + ']的最佳路线为[' + chosenOne ? chosenOne.routeName : '' + ']路班车')
                .subtitle('建议站点为[' + nearestStation.keyword + ']')
                // .text('建议您乘坐XXX路班车')
                // .images([
                //     builder.CardImage.create(session, 'https://docs.microsoft.com/en-us/azure/storage/media/storage-introduction/storage-concepts.png')
                // ])
                .buttons([
                    builder.CardAction.openUrl(session, process.env.LINDE_BUS_URL + 'lng=' + nearestStation.lng + '&lat=' + nearestStation.lat, '查看路线')
                ]));
            deferred.resolve(result);
        });
    });
    return deferred.promise;
};
var calcBusRoute = function (queryPoint, busRoutes) {
    var deferred = Q.defer();
    var nearestStation = {};
    var stations = [];
    busRoutes.forEach(function (route, index) {
        route.stations.forEach(function (station) {
            stations.push(station);
        });
    });
    getAllDistance(queryPoint, stations).then(function (distResults) {
        var shortestInd = 0;
        var shortestDist = 0;
        var tmpDist = 0;
        distResults.forEach(function (dist, index) {
            console.log('@ ' + dist.distance + '');
            if (index == 0) {
                shortestDist = parseFloat(dist.distance);
            }
            tmpDist = parseFloat(dist.distance);
            if (tmpDist < shortestDist) {
                shortestDist = tmpDist;
                shortestInd = index;
            }
        });
        console.log('the shortest one is ' + shortestDist + ' and the index is ' + shortestInd);

        nearestStation = stations[shortestInd];
        deferred.resolve(nearestStation);
    });
    return deferred.promise;
};

var getAllDistance = function (queryPoint, stations) {
    var deferred = Q.defer();
    var destination = queryPoint.location;
    var origins = '';
    stations.forEach(function (station) {
        origins += station.lng;
        origins += ',';
        origins += station.lat;
        origins += '|';
    });
    var apiData = {
        key: AMAP_WEB_API_KEY,
        origins: origins,
        destination: destination,
        output: 'json'
    };
    var content = qs.stringify(apiData);
    var options = {
        hostname: 'restapi.amap.com',
        path: '/v3/distance?' + content,
        method: 'GET'
    };
    var result = [];
    var req = http.request(options, function (res) {
        var responseText = '';
        res.on('data', function (data) {
            responseText += data;
        });
        res.on('end', function () {
            var response = JSON.parse(responseText);
            if(response.results) {
                response.results.forEach(function (point) {
                    result.push(point)
                });
            }
            deferred.resolve(result);
        });

    });
    req.on('error', function (e) {
        console.log('problem with request: ' + e.message);
    });
    req.end();

    return deferred.promise;
};

exports.searchInAmap = function (dests) {
    var deferred = Q.defer();
    //读取文件
    var keywords = '';
    dests.forEach(function (dest) {
        keywords += dest.entity + '|';
    });
    var apiData = {
        key: AMAP_WEB_API_KEY,
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
        var responseText = '';
        res.on('data', function (data) {
            responseText += data;
        });
        res.on('end', function () {
            JSON.parse(responseText).pois.forEach(function (point) {
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