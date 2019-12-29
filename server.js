// Changeable Variables
const localPort = 6968; // Port used for the local portion of application. Only the server should be able to access this.
const appPort = 6969; // Port used to allow other devices to connect to the server. 6969 recommended for immature reasons.
const inactiveTime = 7; // If the app or tab is closed for this many seconds, the device's status is set to inactive and other devices won't list it.
const uploadLimit = 100; // Number of files that can be uploaded at a time.
const keySize = 2048; // RSA key length (in bits). The bigger the key, the more secure the encryption (at the cost of speed). 2048 recommended.

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
const jsencrypt = require("node-jsencrypt");
const aes = require("aes-js");
const rsa = require("node-rsa");
const md5 = require("md5");
const sha256 = require("sha256");
const chalk = require("chalk");
const bodyParser = require("body-parser");

var downloadDirectory = os.homedir() + "/Downloads/";
var dataDirectory = path.join(__dirname, "./data/");

var dataFile = dataDirectory + "data.txt";
var keysFile = dataDirectory + "keys.txt";

const { app, BrowserWindow, screen, ipcMain } = electron;

app.requestSingleInstanceLock();
app.name = "X:/LANDrop";

console.log("\n" + chalk.magenta(new Date().toLocaleTimeString()));

app.on("ready", function() {
	const localExpress = express();
	const appExpress = express();
	const localServer = localExpress.listen(localPort, "localhost");
	const appServer = appExpress.listen(appPort);
	
	localServer.on("error", function(error) {
		if(error.code == "EADDRINUSE") {
			console.log("\n" + chalk.red("Port " + localPort + " is in use."));
			app.exit(0);
		}
	});
	appServer.on("error", function(error) {
		if(error.code == "EADDRINUSE") {
			console.log("\n" + chalk.red("Port " + appPort + " is in use."));
			app.exit(0);
		}
	});
	
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;
	var localWidth = 540;
	var localHeight = height - 100;
	
	const localWindow = new BrowserWindow({ width:localWidth, height:localHeight, resizable:false, frame:true, webPreferences:{ nodeIntegration:true }});
	localWindow.loadURL("file://" + path.join(__dirname, "./views/local.html") + "?localPort=" + localPort);
	
	if(!fs.existsSync(dataDirectory)) {
		console.log(chalk.red("\nNo \"Data\" folder found."));
		fs.mkdir(dataDirectory, function(error) {
			if(error) {
				console.log(error);
				app.exit(0);
			}
			else {
				console.log(chalk.green("\nCreated \"Data\" folder."));
			}
		});
	}

	if(!fs.existsSync(dataFile)) {
		console.log(chalk.red("\nNo \"Data\" file found."));
		fs.writeFile(dataFile, "", function(error) {
			if(error) {
				console.log(error);
				app.exit(0);
			}
			else {
				console.log(chalk.green("\nCreated \"Data\" File."));
			}
		});
	}
	
	if(!fs.existsSync(keysFile)) {
		console.log(chalk.red("\nNo \"Keys\" file found."));
		generateKeysFile();
	}
	else {
		fs.readFile(keysFile, { encoding:"utf-8" }, function(error, json) {
			if(!empty(json)) {
				verifyKeys(json);
			}
			else {
				generateKeysFile();
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
					app.exit(0);
				}
				else {
					console.log(chalk.green("\nCreated \"Downloads\" folder."));
				}
			});
		}
	}
	
	fs.watchFile(dataFile, function(current, previous) {
		fs.readFile(dataFile, { encoding:"utf-8" }, function(error, json) {
			localWindow.webContents.send("userRequest", { data:json });
		});
	});

	var lastActive = epoch();

	localExpress.set("view engine", "ejs");
	localExpress.use("/assets", express.static("assets"));
	localExpress.use(bodyParser.urlencoded({ extended:true }));
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
			fs.readFile(dataFile, { encoding:"utf-8" }, function(error, json) {
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
						else {
							data = JSON.stringify(data);
						}
						
						fs.writeFile(dataFile, data, function(error) {
							if(error) {
								console.log(error);
							}
							else {
								localWindow.webContents.send("APIResponse", { action:"get-notifications", data:data });
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
						var publicKey = "";
						
						try {
							var data = JSON.parse(body);
							
							if(data.status == "active") {
								status = "active";
							}
							
							if(data.permission == "allow") {
								permission = "allow";
							}
							else if(data.permission == "blocked") {
								permission = "blocked";
							}
							
							publicKey = data.publicKey;
							
							localWindow.webContents.send("APIResponse", { action:"check-device", ip:req.ip, status:status, hashed:md5(req.ip), permission:permission, publicKey:publicKey });
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
	appExpress.use(bodyParser.urlencoded({ extended:true, limit:"10000mb" }));
	appExpress.use(bodyParser.json({ limit:"10000mb" }));

	appExpress.get("/", function(req, res) {
		res.redirect("/receive");
	});

	appExpress.post("/receive", function(req, res) {
		fs.readFile(dataFile, { encoding:"utf-8" }, function(error, json) {
			if(error) {
				console.log(error);
			}
			else {
				if(!empty(json)) {
					var data = JSON.parse(json);
					var userIP = req.connection.remoteAddress.replace(/^.*:/, '');
					var user = data[userIP];
					
					if(Object.keys(data).includes(userIP)) {
						if(user.whitelisted) {
							res.setHeader("Access-Control-Allow-Origin", "*");
							
							var count = 1;
							
							var keys = getKeys();
							var privateKey = "";
							
							if(!empty(keys)) {
								keys = JSON.parse(keys);
								privateKey = keys.privateKey;
							}
							
							var encryptedContent = req.body.fileContent;
							var filename = req.body.filename;
							var key = rsaDecrypt(req.body.key, privateKey);
							var iv = req.body.iv;
							
							var keyBytes = aes.utils.utf8.toBytes(key);
							var ivBytes = aes.utils.utf8.toBytes(iv);
							
							var decryptedContent = aesDecrypt(encryptedContent, keyBytes, ivBytes);

							var originalName = filename.replace(/[/\\?%*:|"<>]/g, '-');
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
									name = filename.replace(/[/\\?%*:|"<>]/g, '-') + " (" + count + ")";
								}
							}
							
							var buffer = new Buffer.from(decryptedContent, "base64");
							
							fs.writeFile(downloadDirectory + name, buffer, function(error) {
								if(error) {
									console.log(error);
								}
							});
							
							res.send("sent");
							localWindow.webContents.send("notify", { title:"File Received", description:userIP + " has sent you one or more files.", duration:4000 });
						}
					}
				}
			}
		});
	});
	
	appExpress.get("/permission", function(req, res) {
		res.setHeader("Access-Control-Allow-Origin", "*");
		var ipAddress = req.connection.remoteAddress.replace(/^.*:/, '');
		fs.readFile(dataFile, { encoding:"utf-8" }, function(error, json) {
			if(error) {
				console.log(error);
			}
			else {
				if(!empty(json)) {
					var data = JSON.parse(json);
					var ips = Object.keys(data);
					
					if(ips.includes(ipAddress)) {
						var user = data[ipAddress];
						if(!user.blacklisted && !user.whitelisted) {
							localWindow.webContents.send("userRequest", { ip:ipAddress, data:json });
							res.send("sent");
							console.log(ipAddress + " - Permission Request.");
						}
					}
					else {
						var user = { [ipAddress]:{ whitelisted:false, blacklisted:false }};
						Object.assign(data, user);
						var users = JSON.stringify(data);
						
						fs.writeFile(dataFile, users, function(error) {
							if(error) {
								console.log(error);
							}
							else {
								localWindow.webContents.send("userRequest", { ip:ipAddress, data:users });
								res.send("sent");
								console.log(ipAddress + " - Permission Request.");
							}
						});
					}
				}
				else {
					var user = JSON.stringify({ [ipAddress]:{ whitelisted:false, blacklisted:false }});
					
					fs.writeFile(dataFile, user, function(error) {
						if(error) {
							console.log(error);
						}
						else {
							localWindow.webContents.send("userRequest", { ip:ipAddress, data:user });
							res.send("sent");
							console.log(ipAddress + " - Permission Request.");
						}
					});
				}
			}
		});
	});

	appExpress.get("/receive", function(req, res) {
		var ipAddress = req.connection.remoteAddress.replace(/^.*:/, '');
		if(ipAddress != ip.address()) {
			res.setHeader("Access-Control-Allow-Origin", "*");
			
			var keys = getKeys();
			var publicKey = "";
			
			if(!empty(keys)) {
				keys = JSON.parse(keys);
				publicKey = keys.publicKey;
			}
			
			if(epoch() - lastActive < inactiveTime) {
				res.render("app", { ip:ipAddress, publicKey:publicKey });
			}
			else {
				res.send("inactive");
			}
		}
		else {
			res.send("You can't send yourself files...");
		}
	});

	appExpress.get("/status", function(req, res) {
		res.setHeader("Access-Control-Allow-Origin", "*");
		
		var ipAddress = req.connection.remoteAddress.replace(/^.*:/, '');
		
		if(epoch() - lastActive < inactiveTime) {
			fs.readFile(dataFile, { encoding:"utf-8" }, function(error, json) {
				if(error) {
					console.log(error);
				}
				else {
					var permission = "disallow";
					
					if(!empty(json)) {
						var data = JSON.parse(json);
						var user = data[ipAddress];
						
						if(Object.keys(data).includes(ipAddress)) {
							if(user.whitelisted) {
								permission = "allow";
							}
							
							if(user.blacklisted) {
								permission = "blocked";
							}
						}
					}
					
					var keys = getKeys();
					var publicKey = "";
					
					if(!empty(keys)) {
						keys = JSON.parse(keys);
						publicKey = keys.publicKey;
					}
					
					var body = { status:"active", permission:permission, publicKey:publicKey };
					res.send(JSON.stringify(body));
				}
			});
		}
		else {
			res.send("inactive");
		}
	});
});

// Create a text file and put the user's private and public key in it.
function generateKeysFile() {
	var keys = JSON.stringify(rsaGenerateKeys());
	fs.writeFile(keysFile, keys, function(error) {
		if(error) {
			console.log(error);
			app.exit(0);
		}
		else {
			console.log(chalk.green("\nGenerated Keys."));
			verifyKeys(keys);
		}
	});
}
// Verify generated RSA key pair.
function verifyKeys(json) {
	if(!empty(json)) {
		var keys = JSON.parse(json);
		var publicKey = keys.publicKey;
		var publicKeyChecksum = sha256(publicKey);
		var publicKeyValid = keys.publicKeyChecksum;
		var privateKey = keys.privateKey;
		var privateKeyChecksum = sha256(privateKey);
		var privateKeyValid = keys.privateKeyChecksum;
		
		if(publicKeyChecksum != publicKeyValid || privateKeyChecksum != privateKeyValid) {
			console.log(chalk.red("\nCouldn't verify keys. Generating them again..."));
			generateKeysFile();
			return false;
		}
		else {
			return true;
		}
	}
	else {
		console.log(chalk.red("\nCouldn't verify keys."));
		app.exit(0);
	}
}
// Get keys.
function getKeys() {
	return fs.readFileSync(keysFile, { encoding:"utf-8" }, function(error, json) {
		if(error) {
			console.log(error);
		}
	});
}

// Generate RSA key pair.
function rsaGenerateKeys() {
	var key = new rsa();
	key.generateKeyPair(keySize);
	var publicKey = key.exportKey("pkcs8-public");
	var publicKeyChecksum = sha256(publicKey);
	var privateKey = key.exportKey("pkcs8-private");
	var privateKeyChecksum = sha256(privateKey);
	return { publicKey:publicKey, publicKeyChecksum:publicKeyChecksum, privateKey:privateKey, privateKeyChecksum:privateKeyChecksum };
}
// Encrypt text.
function rsaEncrypt(plaintext, key) {
	var jsEnc = new jsencrypt();
	jsEnc.setKey(key);
	return jsEnc.encrypt(plaintext);
}
// Decrypt text.
function rsaDecrypt(encrypted, key) {
	var jsEnc = new jsencrypt();
	jsEnc.setKey(key);
	return jsEnc.decrypt(encrypted);
}

// Encrypt data with AES-256-CTR.
function aesEncrypt(plaintext, key) {
	var bytes = aes.utils.utf8.toBytes(plaintext);
	var buffer = Buffer.from(key);
	var iv = crypto.randomBytes(16);
	var aesCTR = new aes.ModeOfOperation.ctr(buffer, iv);
	var encryptedBytes = aesCTR.encrypt(bytes);
	var encryptedHex = aes.utils.hex.fromBytes(encryptedBytes);
	return { ciphertext:encryptedHex, iv:iv };
}
// Decrypt data that's been encrypted with AES-256-CTR.
function aesDecrypt(ciphertext, key, iv) {
	var encryptedBytes = aes.utils.hex.toBytes(ciphertext);
	var buffer = Buffer.from(key);
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
console.log(chalk.cyan("\nKeys File: ") + keysFile);
console.log(chalk.cyan("\nDownload Directory: ") + downloadDirectory + "\n");

console.log(chalk.yellow("Local: ") + ip.address() + ":" + localPort);
console.log(chalk.yellow("App: ") + ip.address() + ":" + appPort);