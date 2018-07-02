var fs = require('fs');
var shell = require('shelljs');
var winston = require('winston');
var child_process = require('child_process');
var node_path = require('path');
var events = require('events');
var debug = process.env.DEBUG ? true : false;

var rproc_path = '/sys/class/remoteproc/remoteproc';
var fw_path = '/lib/firmware/am335x-pru';

//modprobe/unprobe
var modProbe = function (mod, probe) {
    mod = mod || 'pru_rproc'; //default pru_rproc
    probe = typeof probe !== 'undefined' ? probe : true;
    if (probe)
        var cmd = 'modprobe ' + mod; //for modprobe
    else
        var cmd = 'modprobe -r ' + mod; //for  modunprobe
    if (debug) winston.debug('running modprobe');
    code = shell.exec(cmd).code;
    if (code > 0)
        winston.error("modprobe/modunprobe failed");
}
//pru enable/disable
var pruEnable = function (pruno, enable) {
    var pruno = typeof pruno !== 'undefined' ? pruno : '0';
    if (pruno != 0 && pruno != 1) {
        winston.error('PRU Core No. should be 0 or 1');
        return false;
    } else
        pruno += 1;
    var path = rproc_path + pruno + '/state';
    var enable = typeof enable !== 'undefined' ? enable : true;
    var currentState = (fs.readFileSync(path).toString());
    var state;
    if (currentState == 'offline\n' && enable) state = 'start\n'; //start only if offline
    else if (currentState == 'running\n' && !enable) state = 'stop\n'; //stop only if running
    if (typeof state != 'undefined') {
        if (debug) winston.debug('Changing PRU' + pruno + 'state from' + currentState);
        fs.writeFileSync(path, state);
    }
}
//pru reset
var pruReset = function (pruno) {
    if (pruno != 0 && pruno != 1) {
        winston.error('PRU Core No. should be 0 or 1');
        return false;
    }
    pruEnable(pruno, false);
    pruEnable(pruno, true);
}
// loadFirmware
var loadPRUFirmware = function (filepath, pruno) {
    var pruno = typeof pruno !== 'undefined' ? pruno : '0';
    if (pruno != 0 && pruno != 1) {
        winston.error('PRU Core No. should be 0 or 1');
        return false;
    }
    if ((filepath).indexOf('.out') == -1) {
        var filename = node_path.basename(filepath);
        var directory = filepath.replace(filename, '');
        if (debug) winston.debug('compiling and loading firmware: ' + filepath + 'to pru' + pruno) //compile the source using bone101 makefile
        var make = child_process.spawn('/usr/bin/make', [
            "-f",
            "/usr/share/bone101/examples/extras/pru/Makefile",
            "TARGET=" + filename.replace(/\.c$/, ''),
            "PRUN=" + 'pru' + pruno
        ], {
            'cwd': directory
        });
        make.stdout.on('data', (data) => {
            if (debug) winston.debug(`stdout: ${data}`);
        });
        make.stderr.on('data', (data) => {
            winston.error(`stderr: ${data}`);
        });
        return true; //the makfile handles loading of firmware
    } else {
        if (!(fs.existsSync(directory + filename))) {
            winston.error('Firmware file not found');
            return false;
        }
        if (debug) winston.debug('loading firmware: ' + filepath + ' to pru' + pruno)
        pruEnable(pruno, false); //disable PRU before loading firmware if not already disabled
        var path = fw_path + pruno + ' -fw';
        shell.cp(filepath, path); //used because fs.copyFile() not supported, fast enough
        pruEnable(pruno, true); //enable PRU after loading firmware
        return true;
    }
}
//sendmsg
var sendrpMsg = function (message, pruno) {
    var pruno = typeof pruno !== 'undefined' ? pruno : '0';
    if (pruno != 0 && pruno != 1) {
        winston.error('PRU Core No. should be 0 or 1');
        return false;
    }
    pruno += 1;
    var channel = 'rpmsg_pru3' + pruno;
    var path = '/dev/' + channel; //default is rpmsg_pru31
    fs.writeFileSync(path, message + '\n');
}
//getmsg
var getrpMsg = function (pruno) {
    var pruno = typeof pruno !== 'undefined' ? pruno : '0';
    if (pruno != 0 && pruno != 1) {
        winston.error('PRU Core No. should be 0 or 1');
        return false;
    }
    pruno += 1;
    var channel = 'rpmsg_pru3' + pruno;
    var path = '/dev/' + channel;
    if (!(fs.existsSync(path))) {
        winston.error('getMsg failed to fetch message');
        return false;
    } else {
        var rpmsgEmitter = new events.EventEmitter();
        fs.watch(path, function (curr, prev) {
            fs.readFile(path, 'utf8', function (err, data) {
                rpmsgEmitter.emit('rpmsg', data);
            });
        });
        return rpmsgEmitter;
    }
}

module.exports = {
    modProbe: modProbe,
    pruEnable: pruEnable,
    pruReset: pruReset,
    loadPRUFirmware: loadPRUFirmware,
    sendrpMsg: sendrpMsg,
    getrpMsg: getrpMsg
}