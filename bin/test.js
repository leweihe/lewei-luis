var Q = require('q');
var restify = require('restify');
var qs = require('querystring');
var http = require('http');
//http://restapi.amap.com/v3/config/district?key=您的key&keywords=厦门&subdistrict=3&showbiz=true&extensions=base

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
    main();
});

exports.searchDataInAmap = function() {
    var deferred = Q.defer();
    //读取文件
    var apiData = {
        key: '06268f43b75ea67cbe6faa132acc4d19',
        showbiz: 'true',
        keywords: '厦门',
        subdistrict: 3,
        extensions: 'base'
    };
    var content = qs.stringify(apiData);
    var options = {
        hostname: 'restapi.amap.com',
        path: '/v3/config/district?' + content,
        method: 'GET'
    };
    var req = http.request(options, function (res) {
        var responseText='';
        res.on('data', function (data) {
            responseText += data;
        });
        res.on('end', function () {
            deferred.resolve(JSON.parse(responseText));
        });

    });
    req.on('error', function (e) {
        console.log('problem with request: ' + e.message);
    });
    req.end();

    return deferred.promise;
};


var main = function() {
    exports.searchDataInAmap().then(function (result) {
        var abc = '';
        result.districts[0].districts.forEach(function (result) {
                    abc += result.name + ',';
            result.districts.forEach(function (result) {
                    abc += result.name + ',';
            });
        });
        console.log('end')
        console.log(abc);
    });
};