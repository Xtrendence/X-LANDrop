# X:/LANDrop

### This project is a work in progress.

An AirDrop-like web application that runs on NodeJS, and is wrapped with ElectronJS to allow for cross-platform functionality.

Starting the application hosts a server on the user's device. There are two ways devices can interact with one another:

* User X can host a server, and user Y can connect to it by simply visiting user X's IP address (along with the server's port number, which is 6969 by default) using a browser. From there, user Y can send files to user X, but not the other way around. Obviously user Y cannot send files without user X's permission.

* Both users can host servers, at which point X:/LANDrop will automatically detect the other user on the network, and allow them to share files with one another. If the app fails to detect the other user, the first method can still be used.

Before a user can send files to another user, they need to ask for permission. The other user can either add them to their whitelist, blacklist or simply decline their request.

Since X:/LANDrop is most likely to be used in a local area network, it's unlikely that users would have SSL, so 2048-bit (changeable) RSA keys are generated when the app is first launched, and the user's public key is accessible to any connecting client. Files are encrypted using AES-256-CTR with a random key and IV. The key is then encrypted (with RSA) using the recipient's public key. On the recipient's side, the key is decrypted using their private key, and is used to decrypt the file. This way, MITM attacks don't pose a threat.

By default, X:/LANDrop saves files to the user's "Downloads" folder.
