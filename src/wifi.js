var shell = require('shelljs');
var winston = require('winston');
var spawn = require('child_process').spawn;

var debug = process.env.DEBUG ? true : false;
//WiFi enable / disable
var enableWiFi = function (option, callback) {
    option = typeof option != undefined ? option : true; //default Enable
    if (option) {
        if (debug) winston.debug('Enabling WiFi');
        shell.exec('connmanctl enable wifi', {
            silent: true
        }, callback);
    } else {
        if (debug) winston.debug('Disabling WiFi');
        shell.exec('connmanctl disable wifi', {
            silent: true
        }, callback);
    }
}
var getWiFiarr = function (callback) { //not exported
    var WiFiarr = [];
    shell.exec('connmanctl scan wifi', {
        silent: true
    });
    var cmd = shell.exec('connmanctl services', {
        silent: true
    });
    console.log(result);
    var result = cmd.stdout;
    var err = cmd.stderr;
    var resultArray = result.split('\n').filter(function (e) {
        return e.trim().length > 0;
    });
    for (var x in resultArray) {
        var splitResult = resultArray[x].split(/(\s+)/).filter(function (e) {
            return e.trim().length > 0;
        });
        WiFiarr.push({
            SSID: splitResult[0],
            key: splitResult[1]
        });
    }
    callback(err, WiFiarr);
}
//get SSID list
var listWiFi = function (callback) {
    var SSID = [];
    getWiFiarr(function (err, WiFiarr) {
        for (var x in WiFiarr)
            SSID[x] = WiFiarr[x].SSID
        callback(err, SSID);
    });
}
//connect to ssid ,password
var connectWiFi = function (ssid, password, callback) {
    var connKey;
    getWiFiarr(function (error, WiFiarr) {
        for (var x in WiFiarr) {
            if (WiFiarr[x].SSID == ssid)
                connKey = WiFiarr[x].key;

        }
    });
    if (typeof connKey != 'undefined') {
        connmanctl = spawn('connmanctl');
        //connmanctl.stdout.pipe(process.stdout);
        connmanctl.stdin.write("agent on\n");
        connmanctl.stdin.write("connect " + connKey + "\n");
        connmanctl.stdin.write(password + "\n");
        connmanctl.stdin.end();
        callback(null);
    } else
        callback('SSID not found');
}
module.exports = {
    enableWiFi: enableWiFi,
    listWiFi: listWiFi,
    connectWiFi: connectWiFi
}