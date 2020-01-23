# X:/LANDrop

An AirDrop-like web application that runs on NodeJS, and is wrapped with ElectronJS to allow for cross-platform functionality.

Starting the application hosts a server on the user's device. There are two ways devices can interact with one another:

* User X can host a server, and user Y can connect to it by simply visiting user X's IP address (along with the server's port number, which is 6969 by default) using a browser. From there, user Y can send files to user X, but not the other way around. Obviously user Y cannot send files without user X's permission.

* Both users can host servers, at which point X:/LANDrop will automatically detect the other user on the network, and allow them to share files with one another. If the app fails to detect the other user, the first method can still be used.

Before a user can send files to another user, they need to ask for permission. The other user can either add them to their whitelist, blacklist or simply decline their request.

Since X:/LANDrop is most likely to be used in a local area network, it's unlikely that users would have SSL, so 2048-bit (changeable) RSA keys are generated when the app is first launched, and the user's public key is accessible to any connecting client. Files are encrypted using AES-256-CTR with a random key and IV. The key is then encrypted (with RSA) using the recipient's public key. On the recipient's side, the key is decrypted using their private key, and is used to decrypt the file. This way, MITM attacks don't pose a threat.

By default, X:/LANDrop saves files to the user's "Downloads" folder. The maximum upload file size is 10GBs, but since the file content is being read by the browser before being encrypted and sent to the server through an HTTP POST request, it's highly recommended not to exceed ~1GB, though it'll probably work, I just wouldn't rely on it.

### Launch using Electron:

If you don't want to download the app using the links below, you can download the source code, "cd" into the directory, run "npm install", run "npm i -g electron", "npm i -g nodemon" and then start the app using "nodemon --exec electron ." and it should launch.

## Download

|Download Link|Checksum (SHA-512)|
|-------------|------------------|
|[**Mac**](https://drive.google.com/open?id=1T0i60oh7IqAPd6mkDSP8sHJy25FQf1c0)|c292f4e36ab8507c6ff99937ac6361ee0b8e07c700e96d97fedc3b893955798cd6b8ebf8794baef122893beb69cc71c298aa4b0d44f42e6277b8fb3911483d7f|
|[**Linux**](https://drive.google.com/open?id=107DdbZTeB4Ng1nT8C44jvtYE86ZBaX0B)|c57a850674e16c291ba02350a8edb3f14a3126d83a4af22b1007bf2814b051248c318cd21c5d3741fb0ba412a5310f0d2e5d0d423b985cb2183961104d03abe2|
|[**Windows**](https://drive.google.com/open?id=1GfA8Z_8m1UdVknROlGbC8aJgH3QiojRC)|f657aaf667e71ac88129e3fd438bf3a96cd1f56b3763a19c75ce9d2b7387fee090eae2d10bc07c8be08bb3c08c38333196f6ea90c5f816694d43d3dc0c1ae12f|

*Please note that on Mac it might say that the application can't be opened because it's from an unidentified developer. To fix this, simply open **System Preferences**, go to **Security & Privacy**, click on the **General** tab, and find the **Open Anyway** button at the bottom of the page.*
