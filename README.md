# Voxel-Engine
This is my JavaScript voxel game/physics engine.

It can render a few million voxels at a solid framerate (on my ancient PC), and compute physics and realtime destruction.<br>My goal is to have it be as large-scale as [Teardown](https://store.steampowered.com/app/1167630/Teardown/), but much more efficient in both rendering and physics calculations.

![Debug Mode Screenshot](https://user-images.githubusercontent.com/66288732/189521938-1b4f1a0a-ed2e-4046-86fa-b19eb5f5939a.png)

Currently, custom models can be imported using the [Voxelizer](https://drububu.com/miscellaneous/voxelizer/?out=avo_cubes), exporting as JSON.
The loader does not support transparency (yet) but it shouldn't be very difficult to implement.

The engine will divide the model into chunks (of gpu-instanced cubes) and will save the same chunks in memory for physics calculations. The rendering uses Three.js (WebGL), with a separate raycasting system.

**TODO:**

The physics implemented are cannones-based and are quite poor. Using something that can support convex hulls would be much preferred, but I can't find a JavaScript-compaible engine that has support for that in 3D yet, so maybe I'll build my own. For now, a square mesh is created (see the colorful lines in the screenshot above) that acts as a box collider.

Alternatively, particle physics could work (rounded to one world unit), with interpolation to make it look smooth.
