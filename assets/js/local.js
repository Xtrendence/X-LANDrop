document.addEventListener("DOMContentLoaded", function() {
	var body = document.getElementsByTagName("body")[0];
	var deviceList = document.getElementsByClassName("device-list")[0];
	var userIP = document.getElementsByClassName("user-ip")[0];
	var userPort = document.getElementsByClassName("user-port")[0];

	APIRequest({ action:"get-ip" });
	APIRequest({ action:"get-devices" });

	var scanDevices = setInterval(function() {
		APIRequest({ action:"get-devices" });
	}, 3500);

	if(detectMobile()) {
		body.id = "mobile";
	}
	else {
		body.id = "desktop";
	}

	function APIRequest(data) {
		var xhr = new XMLHttpRequest();
		xhr.addEventListener("readystatechange", function() {
			if(xhr.readyState == XMLHttpRequest.DONE) {
				if(!empty(xhr.responseText)) {
					try {
						var response = JSON.parse(xhr.responseText);
						var action = response.action;

						if(action == "get-ip") {
							userIP.textContent = response.ip;
							userPort.textContent = response.port;
							if(empty(response.ip) || empty(response.port)) {
								setTimeout(function() {
									APIRequest({ action:"get-ip" });
								}, 2000);
							}
						}
						else if(action == "get-devices") {
							if(!empty(response.list)) {
								var devices = response.list;
								for(var i = 0; i < devices.length; i++) {
									APIRequest({ action:"check-device", ip:devices[i] });
								}
							}
						}
						else if(action == "check-device") {
							var status = response.status;
							if(status == "active" && response.ip != userIP.textContent) {
								if(document.getElementsByClassName("loading-overlay").length > 0) {
									document.getElementsByClassName("loading-overlay")[0].remove();
								}
								if(!document.getElementById(response.ip)) {
									var hashedIP = md5(response.ip);
									var device = '<div class="device" id="' + response.ip + '"><span class="device-ip">' + response.ip + '</span><button class="send-button" id="' + hashedIP + '">Send File</button></div>';
									deviceList.innerHTML += device;

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

											xhrUpload.addEventListener("readystatechange", function() {
												if(xhrUpload.readyState == XMLHttpRequest.DONE) {

												}
											});

											xhrUpload.open("POST", "http://" + response.ip + ":" + userPort.textContent + "/receive", true);
											xhrUpload.send(formData);
										});
									});
								}
							}
							else if(status != "active" || empty(status) && document.getElementById(response.ip)) {
								document.getElementById(response.ip).remove();
								if(empty(deviceList.innerHTML)) {
									deviceList.innerHTML = '<button class="loading-overlay">No Devices Found...</button>';
								}
							}
						}
					}
					catch(e) {
						console.log(e);
					}
				}
			}
		});
		xhr.addEventListener("error", function(error) {
			if(document.getElementsByClassName("page-overlay").length > 0) {
				document.getElementsByClassName("page-overlay").remove();
			}
			body.innerHTML += '<button class="page-overlay">Error. API Inactive.</button>';
		});
		xhr.open("POST", "/api", true);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify(data));
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

// Notification functionality.
function notify(title, description, color, duration) {
	var area = document.createElement("div");
	area.classList.add("notifiaction-area");
	area.classList.add("noselect");
	document.body.appendChild(area);
	var notification = document.createElement("div");
	notification.classList.add("notification-wrapper");
	notification.innerHTML = '<div class="notification-bubble" style="background:' + color + ';"><div class="notification-title-wrapper"><span class="notification-title">' + title + '</span></div><div class="notification-description-wrapper"><span class="notification-description">' + description + '</span></div></div>';
	area.appendChild(notification);
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

// Detect whether or not the user is on a mobile browser.
function detectMobile() {
	var check = false;
	(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
	return check;
}