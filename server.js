const port = 6969;

const express = require("express");
const session = require("express-session");
const app = express();
const server = app.listen(port);

const fs = require("fs");
const path = require("path");
const ip = require("ip");
const find = require("local-devices");
const crypto = require("crypto");
const aes = require("aes-js");
const bodyParser = require("body-parser");

app.set("view engine", "ejs");
app.use("/assets", express.static("assets"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", function(req, res) {
	res.render("app");
});

app.post("/send", function(req, res) {

});

app.post("/receive", function(req, res) {

});

app.post("/api", function(req, res) {
	var action = req.body.action;
	if(action == "get-ip") {
		res.send({ action:"get-ip", ip:ip.address(), port:port });
	}
	else if(action == "get-devices") {
		find().then(function(devices) {
			res.send({ action:"get-devices", list:devices });
		});
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

console.log("Running At: " + ip.address() + ":" + port);