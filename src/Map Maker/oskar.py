import taichi as ti
import numpy as np

# Voxel resolution
voxel_res = 64

# Scene settings
scene_size = 2.0
camera_pos = ti.Vector([1.0, 1.0, 1.0])
camera_dir = ti.Vector([-1.0, -1.0, -1.0]).normalized()
bg_color = ti.Vector([0.0, 0.0, 0.0])
max_bounce = 10

# Create Taichi canvas
ti.init(arch=ti.cpu)
canvas = ti.Vector.field(3, dtype=ti.f32, shape=(voxel_res * 4, voxel_res * 4))

# Voxel grid
voxels = ti.field(dtype=ti.f32, shape=(voxel_res, voxel_res, voxel_res))

@ti.kernel
def clear_canvas():
    for i, j in canvas:
        canvas[i, j] = bg_color


@ti.func
def voxel_sampler(pos):
    # sampler for voxel grid
    # get voxel indices
    i = int(pos.x)
    j = int(pos.y)
    k = int(pos.z)

    # clamp indices to field size
    i = ti.max(0, ti.min(i, voxel_res - 1))
    j = ti.max(0, ti.min(j, voxel_res - 1))
    k = ti.max(0, ti.min(k, voxel_res - 1))

    return voxels[i, j, k]


@ti.func
def trace(ray_origin, ray_dir):
    # Individual Ray Tracing Operation
    # init depths as f32 to avoid type mismatch precision errors
    depth = ti.cast(0.0, ti.f32)
    color = ti.Vector([0.0, 0.0, 0.0])
    attenuation = ti.Vector([1.0, 1.0, 1.0])

    while depth < max_bounce:
        pos = ray_origin + ray_dir * depth
        sample = voxel_sampler(pos)

        if sample > 0.0:
            color = ti.Vector([100.0, 1.0, 1.0]) * sample
            break

        depth += 0.1

    return color


@ti.kernel
def render():
    """
    Main rendering loop.
    """
    print("Rendering...")


    for i, j in canvas:
        uv = ti.Vector([i / voxel_res, j / voxel_res])
        ray_dir = (camera_dir + ti.Vector([uv.x, uv.y, 0.0])).normalized()
        ray_color = trace(camera_pos, ray_dir)
        canvas[i, j] = ray_color



# Generate a random voxel field
@ti.kernel
def generate_voxels():
    # first print the total # of voxels
    for i, j, k in voxels:
        voxels[i, j, k] = ti.random()

print(voxels.shape[0] * voxels.shape[1] * voxels.shape[2], "total voxels")
generate_voxels()
print("done generating voxels")

# Render the scene
clear_canvas()
render()


# on arrow keys, rerender the scene with camera movement
def move_camera(dx: ti.f32, dy: ti.f32):
    camera_pos[0] = camera_pos[0] + dx
    camera_pos[1] = camera_pos[1] + dy
    clear_canvas()
    render()

# GUI
gui = ti.GUI("Map Maker", (voxel_res * 4, voxel_res * 4))
while gui.running:
    gui.set_image(canvas)
    gui.show()

    while gui.get_event(ti.GUI.PRESS):
        if gui.event.key == "a":
            move_camera(-10.0, 0.0)
        elif gui.event.key == "d":
            move_camera(10.0, 0.0)
        elif gui.event.key == "w":
            move_camera(0.0, 10.0)
        elif gui.event.key == "s":
            move_camera(0.0, -10.0)
