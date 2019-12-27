document.addEventListener("DOMContentLoaded", function() {
	const electron = require("electron");
	const { ipcRenderer } = electron;
	
	var localPort = getURLQuery("localPort");
	
	var body = document.getElementsByTagName("body")[0];
	var deviceList = document.getElementsByClassName("device-list")[0];
	var userIP = document.getElementsByClassName("user-ip")[0];
	var userPort = document.getElementsByClassName("user-port")[0];
	
	var divUsers = document.getElementsByClassName("users-icon-wrapper")[0];
	var divUsersMenu = document.getElementsByClassName("users-menu-wrapper")[0];
	var divUsersMenuBottom = document.getElementsByClassName("users-menu-bottom")[0];
	var divUsersListRequests = document.getElementsByClassName("users-menu-list requests")[0];
	var divUsersListWhitelist = document.getElementsByClassName("users-menu-list whitelist")[0];
	var divUsersListBlacklist = document.getElementsByClassName("users-menu-list blacklist")[0];
	
	var buttonCloseUsersMenu = divUsersMenu.getElementsByClassName("close-icon")[0];
	var buttonUsersMenu = document.getElementsByClassName("users-menu-button");
	
	var spanUsersNotification = document.getElementsByClassName("users-icon-notification")[0];

	ipcRenderer.send("APIRequest", { action:"get-ip" });
	ipcRenderer.send("APIRequest", { action:"get-devices" });
	ipcRenderer.send("APIRequest", { action:"get-notifications" });
	
	scanAnimation();

	var scanDevices = setInterval(function() {
		ipcRenderer.send("APIRequest", { action:"get-devices" });
	}, 3000);
	
	var animation = setInterval(function() {
		scanAnimation();
	}, 450);

	if(detectMobile()) {
		body.id = "mobile";
	}
	else {
		body.id = "desktop";
	}
	
	divUsers.addEventListener("click", function() {
		showUsersMenu();
	});
	
	buttonCloseUsersMenu.addEventListener("click", function() {
		divUsersMenu.style.display = "none";
	});
	
	for(var i = 0; i < buttonUsersMenu.length; i++) {
		buttonUsersMenu[i].addEventListener("click", function() {
			for(var i = 0; i < buttonUsersMenu.length; i++) {
				buttonUsersMenu[i].classList.remove("active");
			}
			
			this.classList.add("active");
			
			divUsersListRequests.style.display = "none";
			divUsersListWhitelist.style.display = "none";
			divUsersListBlacklist.style.display = "none";
			
			if(this.classList.contains("requests")) {
				divUsersListRequests.style.display = "block";
			}
			else if(this.classList.contains("whitelist")) {
				divUsersListWhitelist.style.display = "block";
			}
			else if(this.classList.contains("blacklist")) {
				divUsersListBlacklist.style.display = "block";
			}
		});
	}
	
	ipcRenderer.on("userRequest", function(error, res) {
		processNotifications(res.data);
		notify("Permission Required", res.ip + " would like to send you a file.", "rgb(20,20,20)", 4000, true);
	});
	
	ipcRenderer.on("APIResponse", function(error, res) {
		var action = res.action;

		if(action == "get-ip") {
			userIP.textContent = res.ip;
			userPort.textContent = res.port;
			if(empty(res.ip) || empty(res.port)) {
				setTimeout(function() {
					ipcRenderer.send("APIRequest", { action:"get-ip" });
				}, 2000);
			}
		}
		else if(action == "get-devices") {
			if(!empty(res.list)) {
				var devices = res.list;
				for(var i = 0; i < devices.length; i++) {
					ipcRenderer.send("APIRequest", { action:"check-device", ip:devices[i] });
				}
			}
		}
		else if(action == "get-notifications") {
			processNotifications(res.data);
		}
		else if(action == "check-device") {
			var status = res.status;
			var permission = res.permission;
			if(status == "active" && permission != "blocked" && res.ip != userIP.textContent) {
				if(document.getElementsByClassName("loading-overlay").length > 0) {
					document.getElementsByClassName("loading-overlay")[0].remove();
				}
				if(!document.getElementById(res.ip)) {
					var hashedIP = res.hashed;
					
					if(document.getElementById(hashedIP)) {
						document.getElementById(hashedIP).remove();
					}
					
					if(permission == "allow") {
						var device = '<div class="device" id="' + res.ip + '" data-permission="' + permission + '"><button class="progress"></button><span class="device-ip">' + res.ip + '</span><button class="send-button" id="' + hashedIP + '">Send File</button></div>';
						
						deviceList.innerHTML += device;
						
						var progressBar = document.getElementById(res.ip).getElementsByClassName("progress")[0];

						document.getElementById(hashedIP).addEventListener("click", function() {
							var input = document.createElement("input");
							input.classList.add("hidden");
							input.classList.add("file-input")
							input.type = "file";
							input.name = "files";
							input.multiple = true;

							body.appendChild(input);

							input.click();

							input.addEventListener("change", function() {
								var formData = new FormData();

								for(var i = 0; i < input.files.length; i++) {
									formData.append("files", input.files[i]);
								}

								var xhrUpload = new XMLHttpRequest();

								xhrUpload.upload.addEventListener("progress", function(e) {
									if(e.lengthComputable) {
										var percentage = ((e.loaded / e.total) * 100).toFixed(2);
										
										progressBar.style.width = percentage + "%";
										
										if(percentage > 20) {
											progressBar.textContent = Math.floor(percentage) + "%";
										}
										
										if(percentage == 100) {
											if(input.files.length > 1) {
												notify("Sent", "The files have been successfully sent.", "rgb(20,20,20)", 4000, false);
											}
											else {
												notify("Sent", "The file has been successfully sent.", "rgb(20,20,20)", 4000, false);
											}
											
											setTimeout(function() {
												progressBar.textContent = "";
												progressBar.removeAttribute("style");
											}, 1500);
										}
									}
								});

								xhrUpload.open("POST", "http://" + res.ip + ":" + userPort.textContent + "/receive", true);
								xhrUpload.send(formData);
							});
						});
					}
					else if(permission == "disallow") {
						var device = '<div class="device" id="' + res.ip + '" data-permission="' + permission + '"><span class="device-ip">' + res.ip + '</span><button class="permission-button" id="' + hashedIP + '">Ask Permission</button></div>';
						
						deviceList.innerHTML += device;
						
						document.getElementById(hashedIP).addEventListener("click", function() {
							var xhr = new XMLHttpRequest();
							
							xhr.addEventListener("readystatechange", function() {
								if(xhr.readyState == XMLHttpRequest.DONE) {
									if(xhr.responseText == "sent") {
										notify("Requested", "Permission request sent.", "rgb(20,20,20)", 4000, false);
									}
								}
							})
							
							xhr.open("GET", "http://" + res.ip + ":" + userPort.textContent + "/permission", true);
							xhr.send();
						});
					}
				}
				else if(document.getElementById(res.ip).getAttribute("data-permission") != permission) {
					document.getElementById(res.ip).remove();
					if(empty(deviceList.innerHTML)) {
						deviceList.innerHTML = '<button class="loading-overlay animated">Scanning</button>';
					}
					ipcRenderer.send("APIRequest", { action:"get-devices" });
				}
			}
			else if(status != "active" && document.getElementById(res.ip)) {
				document.getElementById(res.ip).remove();
				if(empty(deviceList.innerHTML)) {
					deviceList.innerHTML = '<button class="loading-overlay animated">Scanning</button>';
				}
			}
		}
	});

	function showUsersMenu() {
		divUsersMenu.style.display = "block";
		
		for(var i = 0; i < buttonUsersMenu.length; i++) {
			buttonUsersMenu[i].classList.remove("active");
		}
		
		buttonUsersMenu[0].classList.add("active");
		
		divUsersListRequests.style.display = "block";
		divUsersListWhitelist.style.display = "none";
		divUsersListBlacklist.style.display = "none";
	}
	
	function performUserAction(ip, perform) {
		ipcRenderer.send("APIRequest", { action:"user-action", ip:ip, perform:perform });
	}
	
	function processNotifications(json) {
		var requests = [];
		var whitelist = [];
		var blacklist = [];
		
		var notifications = 0;
		
		if(!empty(json)) {
			var data = JSON.parse(json);
			var ips = Object.keys(data);
			
			for(var i = 0; i < ips.length; i++) {
				var ip = ips[i];
				var user = data[ip];
				
				if(!user.whitelisted && !user.blacklisted) {
					notifications += 1;
					requests.push('<div class="users-menu-item noselect" data-ip="' + ip + '"><span>' + ip + '</span><div><button data-action="block">Block</button><button data-action="decline">Decline</button><button data-action="accept">Accept</button></div>');
				}
				else if(user.whitelisted) {
					whitelist.push('<div class="users-menu-item noselect" data-ip="' + ip + '"><span>' + ip + '</span><div><button data-action="block">Block</button><button data-action="decline">Remove</button></div>');
				}
				else if(user.blacklisted) {
					blacklist.push('<div class="users-menu-item noselect" data-ip="' + ip + '"><span>' + ip + '</span><div><button data-action="unblock">Unblock</button><button data-action="accept">Whitelist</button></div>');
				}
			}
		}
		
		if(notifications > 0) {
			spanUsersNotification.classList.remove("hidden");
			spanUsersNotification.textContent = notifications;
		}
		else {
			spanUsersNotification.classList.add("hidden");
		}
		
		divUsersListRequests.innerHTML = "";
		divUsersListWhitelist.innerHTML = "";
		divUsersListBlacklist.innerHTML = "";
		
		for(var i = 0; i < requests.length; i++) {
			divUsersListRequests.innerHTML += requests[i];
			
			var item = divUsersListRequests.getElementsByClassName("users-menu-item")[i];
			var buttons = item.getElementsByTagName("button");
			
			for(var j = 0; j < buttons.length; j++) {
				buttons[j].addEventListener("click", function() {
					var ip = this.parentNode.parentNode.getAttribute("data-ip");
					var action = this.getAttribute("data-action");
					performUserAction(ip, action);
				});
			}
		}
		for(var i = 0; i < whitelist.length; i++) {
			divUsersListWhitelist.innerHTML += whitelist[i];
			
			var item = divUsersListWhitelist.getElementsByClassName("users-menu-item")[i];
			var buttons = item.getElementsByTagName("button");
			
			for(var j = 0; j < buttons.length; j++) {
				buttons[j].addEventListener("click", function() {
					var ip = this.parentNode.parentNode.getAttribute("data-ip");
					var action = this.getAttribute("data-action");
					performUserAction(ip, action);
				});
			}
		}
		for(var i = 0; i < blacklist.length; i++) {
			divUsersListBlacklist.innerHTML += blacklist[i];
			
			var item = divUsersListBlacklist.getElementsByClassName("users-menu-item")[i];
			var buttons = item.getElementsByTagName("button");
			
			for(var j = 0; j < buttons.length; j++) {
				buttons[j].addEventListener("click", function() {
					var ip = this.parentNode.parentNode.getAttribute("data-ip");
					var action = this.getAttribute("data-action");
					performUserAction(ip, action);
				});
			}
		}
	}
	
	// Notification functionality.
	function notify(title, description, color, duration, permission) {
		if(document.getElementsByClassName("notification-area").length == 0) {
			var area = document.createElement("div");
			area.classList.add("notification-area");
			area.classList.add("noselect");
			document.body.appendChild(area);
		}
		else {
			var area = document.getElementsByClassName("notification-area")[0];
		}
		var notification = document.createElement("div");
		notification.classList.add("notification-wrapper");
		notification.innerHTML = '<div class="notification-bubble" style="background:' + color + ';"><div class="notification-title-wrapper"><span class="notification-title">' + title + '</span></div><div class="notification-description-wrapper"><span class="notification-description">' + description + '</span></div></div>';
		area.appendChild(notification);
		
		if(permission) {
			var bubble = notification.getElementsByClassName("notification-bubble")[0];
			bubble.style.cursor = "pointer";
			bubble.addEventListener("click", function() {
				showUsersMenu();
			});
		}
		
		notification.style.height = notification.scrollHeight + "px";
		notification.style.visibility = "visible";
		notification.getElementsByClassName("notification-bubble")[0].style.left = "20px";
		setTimeout(function() {
			notification.getElementsByClassName("notification-bubble")[0].style.left = "-600px";
			setTimeout(function() {
				notification.remove();
				if(area.innerHTML == "") {
					area.remove();
				}
			}, 500);
		}, duration);
	}
	
	function scanAnimation() {
		if(document.getElementsByClassName("loading-overlay animated").length == 1) {
			var element = document.getElementsByClassName("loading-overlay animated")[0];
			var text = element.textContent;
			
			if(text == "Scanning") {
				element.textContent = "Scanning.";
			}
			else if(text == "Scanning.") {
				element.textContent = "Scanning..";
			}
			else if(text == "Scanning..") {
				element.textContent = "Scanning...";
			}
			else if(text == "Scanning...") {
				element.textContent = "Scanning";
			}
		}
	}
});

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
	var string = string.toString();
	if(string != "null" && typeof string != "undefined" && string.trim() != "" && JSON.stringify(string) != "" && JSON.stringify(string) != "{}") {
		return false;
	}
	return true;
}

// Get URL query by key.
function getURLQuery(key) {  
	return decodeURIComponent(window.location.search.replace(new RegExp("^(?:.*[&\\?]" + encodeURIComponent(key).replace(/[\.\+\*]/g, "\\$&") + "(?:\\=([^&]*))?)?.*$", "i"), "$1"));  
}

// Detect whether or not the user is on a mobile browser.
function detectMobile() {
	var check = false;
	(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
	return check;
}