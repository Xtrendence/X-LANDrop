const localPort = 6968;
const appPort = 6969;

const express = require("express");
const session = require("express-session");
const local = express();
const app = express();
const localServer = local.listen(localPort, "localhost");
const appServer = app.listen(appPort);

const fs = require("fs");
const path = require("path");
const request = require("request");
const ip = require("ip");
const find = require("local-devices");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const aes = require("aes-js");
const bodyParser = require("body-parser");

const userToken = generateToken();

var activity = { active:false, time:epoch() };
var checkActivity = setInterval(function() {
	console.log(epoch() - activity.time);
	if(epoch() - activity.time > 10000) {
		activity.active = false;
		activity.time = epoch() - 20;
	}
}, 10000);

local.set("view engine", "ejs");
local.use("/assets", express.static("assets"));
local.use(bodyParser.urlencoded({ extended: true }));
local.use(bodyParser.json());

local.get("/", function(req, res) {
	res.render("local", { token:userToken });
});

local.post("/send", function(req, res) {

});

local.post("/api", function(req, res) {
	var token = req.body.token;
	if(token == userToken) {
		var action = req.body.action;
		if(action == "get-ip") {
			res.send({ action:"get-ip", ip:ip.address(), port:appPort });
		}
		else if(action == "get-devices") {
			find().then(function(devices) {
				res.send({ action:"get-devices", list:devices });
			});
			activity.active = true;
			activity.time = epoch();
			console.log("check");
		}
		else if(action == "check-device") {
			var url = "http://" + req.body.ip + ":" + appPort + "/receive";
			request({ uri:url }, function(error, response, body) {
				res.send({ action:"check-device", ip:req.body.ip, status:body });
			});
		}
	}
});

app.get("/", function(req, res) {
	res.send("What are you looking for here?");
});

app.post("/receive", function(req, res) {

});

app.get("/receive", function(req, res) {
	if(activity.active === true) {
		res.send("active - " + (epoch() - activity.time).toString());
	}
	else {
		res.send("suspended - " + (epoch() - activity.time).toString());
	}
});

// Encrypt data with AES-256-CTR.
function aesEncrypt(plaintext, key) {
	var bytes = aes.utils.utf8.toBytes(plaintext);
	var buffer = Buffer.from(key.split("$$")[1]);
	var iv = crypto.randomBytes(16);
	var aesCTR = new aes.ModeOfOperation.ctr(buffer, iv);
	var encryptedBytes = aesCTR.encrypt(bytes);
	var encryptedHex = aes.utils.hex.fromBytes(encryptedBytes);
	return { ciphertext:encryptedHex, iv:iv };
}
// Decrypt data that's been encrypted with AES-256-CTR.
function aesDecrypt(ciphertext, key, iv) {
	var encryptedBytes = aes.utils.hex.toBytes(ciphertext);
	var buffer = Buffer.from(key.split("$$")[1]);
	var aesCTR = new aes.ModeOfOperation.ctr(buffer, iv);
	var decryptedBytes = aesCTR.decrypt(encryptedBytes);
	var decryptedText = aes.utils.utf8.fromBytes(decryptedBytes);
	return decryptedText;
}

// Generate a token.
function generateToken() {
	var salt1 = bcrypt.genSaltSync();
	var salt2 = bcrypt.genSaltSync();
	return bcrypt.hashSync(salt1 + salt2, 10);
}

// Get current UNIX timestamp.
function epoch() {
	var date = new Date();
	var time = Math.round(date.getTime() / 1000);
	return time;
}

// Convert date to UNIX timestamp.
function toEpoch(date){
	var date = Date.parse(date);
	return date / 1000;
}

// Replace all occurrences in a string.
String.prototype.replaceAll = function(str1, str2, ignore) {
	return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
}

console.log("Local: " + ip.address() + ":" + localPort);
console.log("App: " + ip.address() + ":" + appPort);