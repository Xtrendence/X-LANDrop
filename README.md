# X:/LANDrop

### This project is a work in progress.

An AirDrop-like web application that would allow devices on the same network to share files with one another. Ideally, ElectronJS would be used as a wrapper to make it more user-friendly. 

The interface would simply have a list of other devices on the network running X:/LANDrop, and a send button next to each of them. Clicking on the send button would open a file dialog and the user would be able to choose a file (or multiple files) to send to the user. The receiving user would receive a notification, and would then be able to accept or reject the send request.

Please note that I'm aware of the existence of Samba, SSH, or whatever else can be used to share files between devices; this is simply a way to practice and experiment with NodeJS, specifically its networking capabilities, discovering other devices, transferring files, and handling multiple file uploads (possibly with chunking).
