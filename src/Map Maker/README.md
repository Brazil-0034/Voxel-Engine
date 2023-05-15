# Austin's Game Engine
my javascript game engine

(made for fun)

## game in editor --> game at runtime
![game in editor](https://user-images.githubusercontent.com/66288732/225178946-97f1406c-7383-4375-beda-a03f9f7278da.png)
![game at runtime](https://user-images.githubusercontent.com/66288732/225179016-1a146231-dc45-44d5-be34-b66091be92f8.png)



### Installation / Build Guide
- git clone this repository
- run `npm install` in the directory
- run `npm start` to launch

### Features & To-Do
- ~~Physically Based Renderer~~
- Physics
- Premade Controller Profiles
- ~~Multi-platform Builds~~
- ~~UI Theme Support~~


The engine is built into an electron container, but can also be executed from the web browser (with the exception of saving/launching save files).
The game "runner" is developed the same way, but can also launch as a web app with no restrictions.

**The engine does not need to be installed to play games made with it, but any game made with it can be imported back into the engine and edited fully.** (For now, textures and models are saved (as blobs) into the savedata.json for each project. Only one file is necessary to edit/play games made with the engine.)
