# X:/LANDrop

An AirDrop-like web application that runs on NodeJS, and is wrapped with ElectronJS to allow for cross-platform functionality.

Starting the application hosts a server on the user's device. There are two ways devices can interact with one another:

* User X can host a server, and user Y can connect to it by simply visiting user X's IP address (along with the server's port number, which is 6969 by default) using a browser. From there, user Y can send files to user X, but not the other way around. Obviously user Y cannot send files without user X's permission.

* Both users can host servers, at which point X:/LANDrop will automatically detect the other user on the network, and allow them to share files with one another. If the app fails to detect the other user, the first method can still be used.

Before a user can send files to another user, they need to ask for permission. The other user can either add them to their whitelist, blacklist or simply decline their request.

Since X:/LANDrop is most likely to be used in a local area network, it's unlikely that users would have SSL, so 2048-bit (changeable) RSA keys are generated when the app is first launched, and the user's public key is accessible to any connecting client. Files are encrypted using AES-256-CTR with a random key and IV. The key is then encrypted (with RSA) using the recipient's public key. On the recipient's side, the key is decrypted using their private key, and is used to decrypt the file. This way, MITM attacks don't pose a threat.

By default, X:/LANDrop saves files to the user's "Downloads" folder. The maximum upload file size is 10GBs, but since the file content is being read by the browser before being encrypted and sent to the server through an HTTP POST request, it's highly recommended not to exceed ~1GB, though it'll probably work, I just wouldn't rely on it.

### Launch using Electron:

If you don't want to download the app using the links below, you can download the source code, "cd" into the directory, run "npm install", run "npm i -g electron" and then start the app using "nodemon --exec electron ." and it should launch.

## Download

|Download Link|Checksum (SHA-256)|
|-------------|------------------|
|[**Mac**](https://drive.google.com/open?id=1mUBLdlbrw72Iy_p28VAS5DXzdSLWZ6_1)|32c8f003f61c30a46ca9db3537f63bec09b849c83879c15fcc1be45d9b44831a|
|[**Linux**](https://drive.google.com/open?id=1G7EG9DLxTOYweQL4DYJ4PYf0HU6UvW4L)|2e6957d15ceb79d2c83c58f8e1d7c482e3ffbe734388159c6494e6bcf98f0395|
|[**Windows**](https://drive.google.com/open?id=1ZWQ0RnwH9Q2TxBCEpZkQD_0otjnSGc7f)|8ec60199ddd1967719d111f66e848654aabbcf8bd45ba65e9b70837078a2cfdb|

*Please note that on Mac it might say that the application can't be opened because it's from an unidentified developer. To fix this, simply open **System Preferences**, go to **Security & Privacy**, click on the **General** tab, and find the **Open Anyway** button at the bottom of the page.*
