// Changeable Variables
const localPort = 6968;
const appPort = 6969;
const inactiveTime = 7;

const express = require("express");
const session = require("express-session");
const local = express();
const app = express();
const localServer = local.listen(localPort, "localhost");
const appServer = app.listen(appPort);

const os = require("os");
const fs = require("fs");
const path = require("path");
const request = require("request");
const ip = require("ip");
const scan = require("evilscan");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const aes = require("aes-js");
const multer = require("multer");
const chalk = require("chalk");
const bodyParser = require("body-parser");

var fileDirectory = os.homedir() + "/Downloads/";

if(!fs.existsSync(fileDirectory)) {
	console.log("No \"Downloads\" folder found.");
	fileDirectory = "./files/";
	if(!fs.existsSync(fileDirectory)) {
		console.log("No \"Files\" folder found.");
		fs.mkdirSync(path.join(__dirname, fileDirectory), function(error) {
			if(error) {
				console.log(error);
			}
			else {
				console.log("Created \"Files\" folder.");
			}
		});
	}
}

var storage = multer.diskStorage({
	destination: function(req, file, cb) {
		cb(null, fileDirectory)
	},
	filename: function(req, file, cb) {
		var count = 1;

		var originalName = file.originalname.replace(/[/\\?%*:|"<>]/g, '-');
		if(originalName.includes(".")) {
			var parts = originalName.split(".");
			var ext = parts[parts.length - 1];
			var nameOnly = parts.slice(0, parts.length - 1);

			var name = nameOnly + "." + ext;
			while(fs.existsSync(path.join(__dirname, fileDirectory + name))) {
				name = nameOnly + " (" + count + ")." + ext;
			}
		}
		else {
			var name = originalName;
			while(fs.existsSync(path.join(__dirname, fileDirectory + name))) {
				name = file.originalname.replace(/[/\\?%*:|"<>]/g, '-') + " (" + count + ")";
			}
		}
		
		
		cb(null, name)
	}
});

const download = multer({ storage:storage });

var lastActive = epoch();

local.set("view engine", "ejs");
local.use("/assets", express.static("assets"));
local.use(bodyParser.urlencoded({ extended: true }));
local.use(bodyParser.json());

local.get("/", function(req, res) {
	res.render("local");
});

local.post("/api", function(req, res) {
	lastActive = epoch();
	
	var action = req.body.action;
	if(action == "get-ip") {
		res.send({ action:"get-ip", ip:ip.address(), port:appPort });
	}
	else if(action == "get-devices") {
		var options = {
			target:ip.address() + "/24",
			port:appPort,
			status:"TROU",
			banner:true
		};

		var devices = [];

		var scanner = new scan(options);

		scanner.on("result", function(data) {
			if(data.status == "open" && data.ip != ip.address()) {
				devices.push(data.ip);
			}
		});

		scanner.on("error", function(error) {
			console.log(error);
		});

		scanner.on("done", function() {
			res.send({ action:"get-devices", list:devices });
		});

		scanner.run();
	}
	else if(action == "check-device") {
		if(req.body.ip != ip.address()) {
			var url = "http://" + req.body.ip + ":" + appPort + "/status";
			request({ uri:url }, function(error, response, body) {
				var status = "inactive";
				if(body == "active") {
					var status = "active";
				}
				
				res.send({ action:"check-device", ip:req.body.ip, status:status });
			});
		}
	}
});

app.set("view engine", "ejs");
app.use("/assets", express.static("assets"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", function(req, res) {
	res.send('What are you looking for here? Did you mean to go <a href="./receive">here</a>?');
});

app.post("/receive", download.array("files", 12), function(req, res) {
	res.setHeader("Access-Control-Allow-Origin", "*");
	var files = req.files;
	res.send("sent");
});

app.get("/receive", function(req, res) {
	res.setHeader("Access-Control-Allow-Origin", "*");
	if(epoch() - lastActive < inactiveTime) {
		res.render("app");
	}
	else {
		res.send("inactive");
	}
});

app.get("/status", function(req, res) {
	res.setHeader("Access-Control-Allow-Origin", "*");
	if(epoch() - lastActive < inactiveTime) {
		res.send("active");
	}
	else {
		res.send("inactive");
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

console.log("\n" + chalk.magenta(new Date().toLocaleTimeString()));

console.log(chalk.cyan("\nFile Directory: ") + fileDirectory + "\n");

console.log(chalk.yellow("Local: ") + ip.address() + ":" + localPort);
console.log(chalk.yellow("App: ") + ip.address() + ":" + appPort + "\n");