#!/usr/bin/env python3
"""Original DollyZoom sample still + clip.

Renders a stylized traveler in a hallway, then a Hitchcock dolly zoom:
the figure stays the same size while the corridor perspective widens.
No photographs and no third-party footage.
"""

from __future__ import annotations

import math
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "demo"
FRAME_DIR = Path("/tmp/dollyzoom-frames")

W, H = 960, 1200
FPS = 24
FRAMES = 96

SUBJECT_Z = 3.15
CAM_NEAR = 0.05
CAM_FAR = 2.05


def smoothstep(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def project(x: float, y: float, z: float, cam_z: float, focal: float, eye_y: float = 1.42):
    depth = max(0.08, z - cam_z)
    sx = W / 2 + (x * focal) / depth
    sy = H * 0.56 - ((y - eye_y) * focal) / depth
    return sx, sy


def mix(a, b, t: float):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def fog(color, depth: float):
    k = max(0.0, min(1.0, (depth - 1.2) / 14.0))
    return mix(color, (8, 10, 18), k)


def camera(t: float):
    # 0 -> approach -> 0 so the encoded loop is seamless.
    zoom = math.sin(math.pi * smoothstep(t))
    cam_z = CAM_NEAR + (CAM_FAR - CAM_NEAR) * zoom
    distance = SUBJECT_Z - cam_z
    base = SUBJECT_Z - CAM_NEAR
    # Wider swing: near walls leave the frame while the figure stays locked.
    focal = 1280 * (distance / base)
    return cam_z, focal, zoom


def poly(draw: ImageDraw.ImageDraw, pts, fill):
    if len(pts) < 3:
        return
    draw.polygon(pts, fill=fill)


def draw_corridor(draw: ImageDraw.ImageDraw, cam_z: float, focal: float):
    def P(x, y, z):
        return project(x, y, z, cam_z, focal)

    far_z = 16.0
    near_z = 3.35
    half_w = 1.85
    ceil_y = 4.4

    # Far wall and a bright exit, which makes the perspective change obvious.
    end = [P(-half_w, 0, far_z), P(half_w, 0, far_z), P(half_w, ceil_y, far_z), P(-half_w, ceil_y, far_z)]
    poly(draw, end, fog((18, 22, 34), far_z - cam_z))
    door = [P(-0.46, 0, far_z - 0.02), P(0.46, 0, far_z - 0.02), P(0.46, 2.15, far_z - 0.02), P(-0.46, 2.15, far_z - 0.02)]
    poly(draw, door, (255, 176, 92))
    inner = [P(-0.30, 0.08, far_z - 0.04), P(0.30, 0.08, far_z - 0.04), P(0.30, 1.95, far_z - 0.04), P(-0.30, 1.95, far_z - 0.04)]
    poly(draw, inner, (255, 214, 150))

    zs = [near_z + i * 0.85 for i in range(16)]
    zs = [z for z in zs if z < far_z]

    for i in range(len(zs) - 1):
        z0, z1 = zs[i], zs[i + 1]
        d0, d1 = z0 - cam_z, z1 - cam_z
        # Floor slab.
        floor_col = fog((46, 34, 28) if i % 2 == 0 else (28, 24, 27), (d0 + d1) / 2)
        poly(
            draw,
            [P(-half_w, 0, z0), P(half_w, 0, z0), P(half_w, 0, z1), P(-half_w, 0, z1)],
            floor_col,
        )
        # Ceiling.
        ceil_col = fog((22, 24, 32) if i % 2 == 0 else (16, 18, 26), (d0 + d1) / 2)
        poly(
            draw,
            [P(-half_w, ceil_y, z0), P(half_w, ceil_y, z0), P(half_w, ceil_y, z1), P(-half_w, ceil_y, z1)],
            ceil_col,
        )
        # Walls. Alternate panels so the sideways expansion reads on a still.
        left_col = fog((58, 42, 36) if i % 2 == 0 else (36, 40, 52), d0)
        right_col = fog((48, 36, 34) if i % 2 == 0 else (32, 36, 48), d0)
        poly(draw, [P(-half_w, 0, z0), P(-half_w, 0, z1), P(-half_w, ceil_y, z1), P(-half_w, ceil_y, z0)], left_col)
        poly(draw, [P(half_w, 0, z0), P(half_w, 0, z1), P(half_w, ceil_y, z1), P(half_w, ceil_y, z0)], right_col)

        # Baseboard and a vertical edge.
        edge = fog((232, 168, 96), d0)
        poly(
            draw,
            [P(-half_w, 0, z0), P(-half_w, 0.08, z0), P(-half_w, 0.08, z1), P(-half_w, 0, z1)],
            edge,
        )
        poly(
            draw,
            [P(half_w, 0, z0), P(half_w, 0.08, z0), P(half_w, 0.08, z1), P(half_w, 0, z1)],
            edge,
        )

    # Ceiling lamps. They slide outward as the field of view widens.
    for z, side in ((5.2, -1), (7.1, 1), (9.4, -1), (12.2, 1), (14.8, -1)):
        x = 0.92 * side
        depth = z - cam_z
        center = P(x, 2.72, z)
        radius = max(4, int(70 / max(depth, 0.4)))
        glow = fog((249, 115, 22), depth * 0.7)
        draw.ellipse(
            [center[0] - radius * 2.4, center[1] - radius, center[0] + radius * 2.4, center[1] + radius],
            fill=glow,
        )
        draw.ellipse(
            [center[0] - radius, center[1] - radius * 0.55, center[0] + radius, center[1] + radius * 0.55],
            fill=(255, 220, 170),
        )


def draw_person(draw: ImageDraw.ImageDraw, zoom: float):
    # Locked screen size and position. Only a tiny breathing shift.
    height = 690
    cx = W / 2
    foot = int(H * 0.90)
    top = foot - height
    sway = math.sin(zoom * math.pi) * 2

    def y(frac: float) -> float:
        return top + height * frac

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.ellipse([cx - 120, foot - 18, cx + 120, foot + 22], fill=(0, 0, 0, 80))
    return shadow, (cx, sway, y, top, foot, height)


def paint_person(base: Image.Image, zoom: float):
    shadow, (cx, sway, y, top, foot, height) = draw_person(ImageDraw.Draw(base), zoom)
    base.alpha_composite(shadow)
    draw = ImageDraw.Draw(base)
    cx += sway

    # Legs.
    draw.polygon(
        [(cx - 46, y(0.58)), (cx - 8, y(0.56)), (cx - 18, foot), (cx - 58, foot)],
        fill=(32, 32, 36),
    )
    draw.polygon(
        [(cx + 8, y(0.56)), (cx + 48, y(0.58)), (cx + 62, foot), (cx + 16, foot)],
        fill=(24, 24, 28),
    )
    # Shoes.
    draw.rounded_rectangle([cx - 70, foot - 22, cx - 12, foot + 4], radius=8, fill=(18, 16, 16))
    draw.rounded_rectangle([cx + 10, foot - 22, cx + 74, foot + 4], radius=8, fill=(18, 16, 16))

    # Coat.
    coat = [
        (cx - 108, y(0.30)),
        (cx + 108, y(0.30)),
        (cx + 86, y(0.64)),
        (cx - 86, y(0.64)),
    ]
    draw.polygon(coat, fill=(194, 65, 12))
    draw.polygon(
        [(cx - 20, y(0.30)), (cx + 20, y(0.30)), (cx + 8, y(0.62)), (cx - 8, y(0.62))],
        fill=(124, 38, 10),
    )
    # Collar and scarf.
    draw.polygon(
        [(cx - 46, y(0.28)), (cx + 46, y(0.28)), (cx + 20, y(0.38)), (cx - 20, y(0.38))],
        fill=(255, 228, 196),
    )

    # Arms.
    draw.polygon(
        [(cx - 108, y(0.32)), (cx - 78, y(0.32)), (cx - 96, y(0.58)), (cx - 128, y(0.56))],
        fill=(154, 52, 12),
    )
    draw.polygon(
        [(cx + 78, y(0.32)), (cx + 108, y(0.32)), (cx + 130, y(0.56)), (cx + 96, y(0.58))],
        fill=(154, 52, 12),
    )

    # Head.
    head_r = 78
    hx, hy = cx, y(0.16)
    draw.ellipse([hx - head_r, hy - head_r, hx + head_r, hy + head_r + 8], fill=(232, 196, 168))
    # Hair.
    draw.pieslice([hx - head_r - 4, hy - head_r - 10, hx + head_r + 4, hy + 20], 200, 340, fill=(28, 22, 20))
    draw.ellipse([hx - head_r + 8, hy - head_r - 6, hx + head_r - 8, hy - 10], fill=(28, 22, 20))
    # Face. Simple and illustrated, not a photograph of a person.
    draw.ellipse([hx - 22, hy - 8, hx - 8, hy + 6], fill=(72, 48, 40))
    draw.ellipse([hx + 8, hy - 8, hx + 22, hy + 6], fill=(72, 48, 40))
    draw.arc([hx - 18, hy + 14, hx + 18, hy + 36], 20, 160, fill=(150, 84, 72), width=3)
    # Ears.
    draw.ellipse([hx - head_r - 6, hy + 4, hx - head_r + 16, hy + 28], fill=(214, 170, 142))
    draw.ellipse([hx + head_r - 16, hy + 4, hx + head_r + 6, hy + 28], fill=(214, 170, 142))


def render_frame(index: int) -> Image.Image:
    t = index / (FRAMES - 1)
    cam_z, focal, zoom = camera(t)
    image = Image.new("RGBA", (W, H), (7, 7, 11, 255))
    draw = ImageDraw.Draw(image)
    draw_corridor(draw, cam_z, focal)
    paint_person(image, zoom)
    # Warm lamp spill on the floor, kept subtle.
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse([W * 0.18, H * 0.62, W * 0.82, H * 0.98], fill=(249, 115, 22, 28))
    image.alpha_composite(glow)
    return image.convert("RGB")


def main():
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in FRAME_DIR.glob("*.jpg"):
        old.unlink()

    first = None
    for i in range(FRAMES):
        frame = render_frame(i)
        path = FRAME_DIR / f"{i:04d}.jpg"
        frame.save(path, quality=92, subsampling=0)
        if i == 0:
            first = frame
        if i % 24 == 0:
            print(f"frame {i}/{FRAMES}")

    if first is None:
        raise SystemExit("no frames")
    before = OUT_DIR / "before.jpg"
    poster = OUT_DIR / "poster.jpg"
    first.save(before, quality=90, optimize=True)
    # Peak of the move, so the poster still shows the widened hallway.
    render_frame(FRAMES // 2).save(poster, quality=90, optimize=True)

    video = OUT_DIR / "dolly-zoom.mp4"
    cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        str(FPS),
        "-i",
        str(FRAME_DIR / "%04d.jpg"),
        "-c:v",
        "libx264",
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-crf",
        "20",
        "-an",
        str(video),
    ]
    subprocess.run(cmd, check=True)
    print(f"wrote {before} ({before.stat().st_size} bytes)")
    print(f"wrote {poster} ({poster.stat().st_size} bytes)")
    print(f"wrote {video} ({video.stat().st_size} bytes)")
    shutil.rmtree(FRAME_DIR, ignore_errors=True)


if __name__ == "__main__":
    main()
