// Changeable Variables
const localPort = 6968;
const appPort = 6969;
const inactiveTime = 7;

const electron = require("electron");
const express = require("express");
const session = require("express-session");

const os = require("os");
const fs = require("fs");
const path = require("path");
const request = require("request");
const ip = require("ip");
const scan = require("evilscan");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const aes = require("aes-js");
const md5 = require("md5");
const multer = require("multer");
const chalk = require("chalk");
const bodyParser = require("body-parser");

var dataFile = path.join(__dirname, "./data/data.txt");
var downloadDirectory = os.homedir() + "/Downloads/";

const { app, BrowserWindow, screen, ipcMain } = electron;

app.requestSingleInstanceLock();
app.setName("X:/LANDrop");

console.log("\n" + chalk.magenta(new Date().toLocaleTimeString()));

app.on("ready", function() {
	const localExpress = express();
	const appExpress = express();
	const localServer = localExpress.listen(localPort, "localhost");
	const appServer = appExpress.listen(appPort);
	
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;
	var localWidth = 540;
	var localHeight = height - 100;
	
	const localWindow = new BrowserWindow({ width:localWidth, height:localHeight, resizable:false, frame:true, webPreferences:{ nodeIntegration:true }});
	localWindow.loadURL("file://" + path.join(__dirname, "./views/local.html") + "?localPort=" + localPort);

	if(!fs.existsSync(dataFile)) {
		console.log(chalk.red("\nNo \"Data\" file found."));
		fs.writeFile(dataFile, "", function(error) {
			if(error) {
				console.log(error);
			}
			else {
				console.log(chalk.green("\nCreated \"Data\" File."));
			}
		});
	}

	if(!fs.existsSync(downloadDirectory)) {
		console.log(chalk.red("\nNo \"Downloads\" folder found."));
		downloadDirectory = "./files/";
		if(!fs.existsSync(downloadDirectory)) {
			console.log(chalk.red("\nNo \"Downloads\" folder found."));
			fs.mkdir(path.join(__dirname, downloadDirectory), function(error) {
				if(error) {
					console.log(error);
				}
				else {
					console.log(chalk.green("\nCreated \"Downloads\" folder."));
				}
			});
		}
	}
	
	fs.watchFile(dataFile, function(current, previous) {
		var content = fs.readFile(dataFile, { encoding:"utf-8" }, function(error, json) {
			localWindow.webContents.send("userRequest", json);
		});
	});

	var storage = multer.diskStorage({
		destination: function(req, file, cb) {
			cb(null, downloadDirectory)
		},
		filename: function(req, file, cb) {
			var count = 1;

			var originalName = file.originalname.replace(/[/\\?%*:|"<>]/g, '-');
			if(originalName.includes(".")) {
				var parts = originalName.split(".");
				var ext = parts[parts.length - 1];
				var nameOnly = parts.slice(0, parts.length - 1);

				var name = nameOnly + "." + ext;
				while(fs.existsSync(path.join(__dirname, downloadDirectory + name))) {
					name = nameOnly + " (" + count + ")." + ext;
				}
			}
			else {
				var name = originalName;
				while(fs.existsSync(path.join(__dirname, downloadDirectory + name))) {
					name = file.originalname.replace(/[/\\?%*:|"<>]/g, '-') + " (" + count + ")";
				}
			}
			
			cb(null, name)
		}
	});

	const download = multer({ storage:storage });

	var lastActive = epoch();

	localExpress.set("view engine", "ejs");
	localExpress.use("/assets", express.static("assets"));
	localExpress.use(bodyParser.urlencoded({ extended: true }));
	localExpress.use(bodyParser.json());

	localExpress.get("/", function(req, res) {
		res.render("local");
	});

	ipcMain.on("APIRequest", function(error, req) {
		lastActive = epoch();
		
		var action = req.action;
		
		if(action == "get-ip") {
			localWindow.webContents.send("APIResponse", { action:"get-ip", ip:ip.address(), port:appPort });
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
				if(data.status == "open" && data.ip != ip.address() && data.ip != "127.0.0.1") {
					devices.push(data.ip);
				}
			});

			scanner.on("error", function(error) {
				console.log(error);
			});

			scanner.on("done", function() {
				localWindow.webContents.send("APIResponse", { action:"get-devices", list:devices });
			});

			scanner.run();
		}
		else if(action == "get-notifications") {
			var content = fs.readFile(dataFile, { encoding:"utf-8" }, function(error, json) {
				localWindow.webContents.send("APIResponse", { action:"get-notifications", data:json });
			});
		}
		else if(action == "user-action") {
			var performAction = req.perform;
			
			fs.readFile(dataFile, { encoding:"utf-8" }, function(error, json) {
				if(error) {
					console.log(error);
				}
				else {
					if(!empty(json)) {
						var data = JSON.parse(json);
						
						if(performAction == "block") {
							data[req.ip]["whitelisted"] = false;
							data[req.ip]["blacklisted"] = true;
						}
						else if(performAction == "unblock") {
							data[req.ip]["whitelisted"] = false;
							data[req.ip]["blacklisted"] = false;
						}
						else if(performAction == "decline") {
							delete data[req.ip];
						}
						else if(performAction == "accept") {
							data[req.ip]["whitelisted"] = true;
							data[req.ip]["blacklisted"] = false;
						}
						
						if(Object.keys(data).length == 0) {
							data = "";
						}
						
						fs.writeFile(dataFile, JSON.stringify(data), function(error) {
							if(error) {
								console.log(error);
							}
							else {
								localWindow.webContents.send("APIResponse", { action:"get-notifications", data:JSON.stringify(data) });
							}
						});
					}
				}
			});
		}
		else if(action == "check-device") {
			if(req.ip != ip.address()) {
				var url = "http://" + req.ip + ":" + appPort + "/status";
				request({ uri:url }, function(error, response, body) {
					if(!empty(body)) {
						var status = "inactive";
						var permission = "disallow";
						
						try {
							var data = JSON.parse(body);
							
							if(data.status == "active") {
								var status = "active";
							}
							
							if(data.permission == "allow") {
								var permission = "allow";
							}
							if(data.permission != "blocked") {
								localWindow.webContents.send("APIResponse", { action:"check-device", ip:req.ip, status:status, hashed:md5(req.ip), permission:permission });
							}
						}
						catch(e) {
							console.log(req.ip + " - Bad \"/status\" Body.");
						}
					}
				});
			}
		}
	});

	appExpress.set("view engine", "ejs");
	appExpress.use("/assets", express.static("assets"));
	appExpress.use(bodyParser.urlencoded({ extended: true }));
	appExpress.use(bodyParser.json());

	appExpress.get("/", function(req, res) {
		res.send('What are you looking for here? Did you mean to go <a href="./receive">here</a>?');
	});

	appExpress.post("/receive", download.array("files", 12), function(req, res) {
		fs.readFile(dataFile, { encoding:"utf-8" }, function(error, json) {
			if(error) {
				console.log(error);
			}
			else {
				if(!empty(json)) {
					var data = JSON.parse(json);
					var user = data[req.connection.remoteAddress.replace(/^.*:/, '')];
					if(user.whitelisted) {
						res.setHeader("Access-Control-Allow-Origin", "*");
						var files = req.files;
						res.send("sent");
					}
				}
			}
		});
	});
	
	appExpress.get("/permission", function(req, res) {
		res.setHeader("Access-Control-Allow-Origin", "*");
		var ip = req.connection.remoteAddress.replace(/^.*:/, '');
		fs.readFile(dataFile, { encoding:"utf-8" }, function(error, json) {
			if(error) {
				console.log(error);
			}
			else {
				if(!empty(json)) {
					var data = JSON.parse(json);
					var ips = Object.keys(data);
					
					if(ips.includes(ip)) {
						var user = data[ip];
						if(!user.blacklisted && !user.whitelisted) {
							localWindow.webContents.send("userRequest", { ip:ip, data:json });
							res.send("sent");
							console.log(ip + " - Permission Request.");
						}
					}
					else {
						var user = { [ip]:{ whitelisted:false, blacklisted:false }};
						Object.assign(data, user);
						var users = JSON.stringify(data);
						
						fs.writeFile(dataFile, users, function(error) {
							if(error) {
								console.log(error);
							}
							else {
								localWindow.webContents.send("userRequest", { ip:ip, data:users });
								res.send("sent");
								console.log(ip + " - Permission Request.");
							}
						});
					}
				}
				else {
					var user = JSON.stringify({ [ip]:{ whitelisted:false, blacklisted:false }});
					
					fs.writeFile(dataFile, user, function(error) {
						if(error) {
							console.log(error);
						}
						else {
							localWindow.webContents.send("userRequest", { ip:ip, data:user });
							res.send("sent");
							console.log(ip + " - Permission Request.");
						}
					});
				}
			}
		});
	});

	appExpress.get("/receive", function(req, res) {
		res.setHeader("Access-Control-Allow-Origin", "*");
		if(epoch() - lastActive < inactiveTime) {
			res.render("app", { ip:[req.connection.remoteAddress.replace(/^.*:/, '')] });
		}
		else {
			res.send("inactive");
		}
	});

	appExpress.get("/status", function(req, res) {
		res.setHeader("Access-Control-Allow-Origin", "*");
		
		var ip = req.connection.remoteAddress.replace(/^.*:/, '');
		
		if(epoch() - lastActive < inactiveTime) {
			fs.readFile(dataFile, { encoding:"utf-8" }, function(error, json) {
				if(error) {
					console.log(error);
				}
				else {
					var permission = "disallow";
					
					if(!empty(json)) {
						var data = JSON.parse(json);
						var user = data[ip];
						if(user.whitelisted) {
							permission = "allow";
						}
						
						if(user.blacklisted) {
							permission = "blocked";
						}
					}
					
					var body = { status:"active", permission:permission };
					res.send(JSON.stringify(body));
				}
			});
		}
		else {
			res.send("inactive");
		}
	});
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

// Check if variable content is empty.
function empty(string) {
	if(typeof string == "undefined") {
		return false;
	}
	var string = string.toString();
	if(string != "null" && string.trim() != "" && JSON.stringify(string) != "" && JSON.stringify(string) != "{}") {
		return false;
	}
	return true;
}

// Replace all occurrences in a string.
String.prototype.replaceAll = function(str1, str2, ignore) {
	return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
}

console.log(chalk.cyan("\nData File: ") + dataFile);
console.log(chalk.cyan("\nDownload Directory: ") + downloadDirectory + "\n");

console.log(chalk.yellow("Local: ") + ip.address() + ":" + localPort);
console.log(chalk.yellow("App: ") + ip.address() + ":" + appPort);