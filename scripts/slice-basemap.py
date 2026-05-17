#!/usr/bin/env python3
"""Slice the Natural Earth II shaded-relief raster into per-continent webps.

Source: NE2_LR_LC_SR_W.tif (16200x8100 equirectangular, full world).
Output: one webp per continent, sized so zoomed-in views stay sharp.
"""
import subprocess
from pathlib import Path
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

SRC = Path("/tmp/ne-fetch/NE2_LR_LC_SR_W.tif")
OUT_DIR = Path("/Users/matthew/Dev/qwizia/public/maps")
SRC_W, SRC_H = 16200, 8100  # equirectangular: lng -180..180, lat 90..-90

# Each region: (lat_top, lat_bottom, lng_left, lng_right, max_wide_px)
# Geographic bounds chosen with a little padding around the continent so
# routes hugging the coast/edge still have visible terrain.
REGIONS = {
    "europe":       (72.0,  34.0, -25.0,  50.0, 4000),
    "africa":       (38.0, -37.0, -20.0,  55.0, 4000),
    "north-america":(75.0,   5.0,-170.0, -50.0, 4000),
    "south-america":(14.0, -56.0, -82.0, -34.0, 3000),
    "asia":         (78.0, -12.0,  25.0, 180.0, 4500),
    "oceania":      (10.0, -50.0, 110.0, 180.0, 3500),
    "world":        (90.0, -90.0,-180.0, 180.0, 8000),  # fallback hi-res world
}

def lng_to_px(lng):  return (lng + 180.0) / 360.0 * SRC_W
def lat_to_px(lat):  return (90.0 - lat) / 180.0 * SRC_H

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"loading {SRC}…")
    src = Image.open(SRC)
    src.load()
    print(f"  {src.size} {src.mode}")

    for name, (lat_t, lat_b, lng_l, lng_r, max_w) in REGIONS.items():
        x0 = int(round(lng_to_px(lng_l)))
        x1 = int(round(lng_to_px(lng_r)))
        y0 = int(round(lat_to_px(lat_t)))
        y1 = int(round(lat_to_px(lat_b)))
        crop = src.crop((x0, y0, x1, y1))
        cw, ch = crop.size
        # Downsample if wider than budget — keeps file size in check.
        if cw > max_w:
            ratio = max_w / cw
            nw = max_w
            nh = int(round(ch * ratio))
            crop = crop.resize((nw, nh), Image.LANCZOS)
        out_png = OUT_DIR / f"{name}.png"
        out_webp = OUT_DIR / f"{name}.webp"
        crop.save(out_png, format="PNG", optimize=False)
        # Quality 60 is the sweet spot for terrain rasters — visually
        # indistinguishable from q=78 at typical zoom but ~63% the bytes.
        subprocess.run(
            ["cwebp", "-q", "60", "-m", "6", str(out_png), "-o", str(out_webp)],
            check=True, capture_output=True,
        )
        out_png.unlink()
        sz_kb = out_webp.stat().st_size // 1024
        print(f"  {name}: {crop.size}  → {sz_kb} KB  (geo: {lat_t}..{lat_b} lat, {lng_l}..{lng_r} lng)")

if __name__ == "__main__":
    main()
