from __future__ import annotations

from pathlib import Path
from typing import Iterable
from math import sin, pi

from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "agent-bubble-dark"
OUT = PUBLIC / "v3"
FRAME = 360
BASELINE = 314
TARGET_HEIGHT = 190
TARGET_WIDTH = 252

VARIANTS = {
    "gray": {
        "shadow": (18, 20, 23),
        "mid": (83, 91, 102),
        "highlight": (205, 213, 224),
        "glow": (148, 163, 184, 34),
        "strength": 0.74,
    },
    "black-gold": {
        "shadow": (18, 16, 14),
        "mid": (96, 72, 28),
        "highlight": (238, 194, 82),
        "glow": (190, 134, 36, 42),
        "strength": 0.62,
    },
    "blue": {
        "shadow": (10, 22, 31),
        "mid": (26, 108, 144),
        "highlight": (125, 220, 255),
        "glow": (56, 189, 248, 42),
        "strength": 0.7,
    },
    "purple": {
        "shadow": (22, 16, 32),
        "mid": (93, 49, 148),
        "highlight": (207, 168, 255),
        "glow": (168, 85, 247, 42),
        "strength": 0.7,
    },
    "red": {
        "shadow": (32, 15, 13),
        "mid": (140, 52, 39),
        "highlight": (255, 149, 106),
        "glow": (239, 68, 68, 40),
        "strength": 0.66,
    },
    "silver": {
        "shadow": (28, 31, 36),
        "mid": (126, 134, 145),
        "highlight": (244, 248, 252),
        "glow": (226, 232, 240, 44),
        "strength": 0.82,
    },
}


def load_sheet(path: Path, frame_width: int = FRAME) -> list[Image.Image]:
    sheet = Image.open(path).convert("RGBA")
    return [
        sheet.crop((i * frame_width, 0, (i + 1) * frame_width, sheet.height))
        for i in range(sheet.width // frame_width)
    ]


def alpha_bbox(frame: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = frame.getchannel("A")
    return alpha.getbbox()


def normalize_frame(
    frame: Image.Image,
    target_height: int = TARGET_HEIGHT,
    target_width: int = TARGET_WIDTH,
) -> Image.Image:
    bbox = alpha_bbox(frame)
    if not bbox:
        return Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))

    subject = frame.crop(bbox)
    scale = min(
        target_height / max(1, subject.height),
        target_width / max(1, subject.width),
    )
    new_size = (
        max(1, round(subject.width * scale)),
        max(1, round(subject.height * scale)),
    )
    subject = subject.resize(new_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    x = (FRAME - subject.width) // 2
    y = BASELINE - subject.height
    canvas.alpha_composite(subject, (x, y))
    return polish(canvas)


def polish(frame: Image.Image) -> Image.Image:
    alpha = frame.getchannel("A")
    rgb = frame.convert("RGB")
    rgb = ImageEnhance.Contrast(rgb).enhance(1.05)
    rgb = ImageEnhance.Color(rgb).enhance(0.92)

    black_gold = Image.new("RGBA", frame.size, (24, 22, 20, 0))
    glow = Image.new("RGBA", frame.size, (172, 126, 34, 0))
    glow.putalpha(alpha.filter(ImageFilter.GaussianBlur(3)).point(lambda p: min(46, p // 7)))

    out = Image.merge("RGBA", (*rgb.split(), alpha))
    out = Image.alpha_composite(black_gold, out)
    out = Image.alpha_composite(glow, out)
    return out


def make_shadow(frame: Image.Image) -> Image.Image:
    alpha = frame.getchannel("A")
    bbox = alpha_bbox(frame)
    shadow_layer = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    if not bbox:
        return shadow_layer

    width = max(70, min(210, bbox[2] - bbox[0]))
    height = max(12, min(26, int(width * 0.11)))
    shadow = Image.new("L", (width, height), 0)
    shadow = ImageOps.expand(shadow, border=8, fill=0)
    shadow_draw = Image.new("RGBA", shadow.size, (0, 0, 0, 0))
    ellipse = Image.new("L", shadow.size, 0)
    # Pillow ImageDraw is imported lazily here by ImageDraw through generated mask.
    from PIL import ImageDraw

    draw = ImageDraw.Draw(ellipse)
    draw.ellipse((8, 8, shadow.size[0] - 8, shadow.size[1] - 8), fill=70)
    shadow_draw.putalpha(ellipse.filter(ImageFilter.GaussianBlur(5)))

    x = (FRAME - shadow_draw.width) // 2
    y = BASELINE - 8
    shadow_layer.alpha_composite(shadow_draw, (x, y))
    return shadow_layer


def compose_frame(frame: Image.Image) -> Image.Image:
    return Image.alpha_composite(make_shadow(frame), frame)


def transform_frame(
    frame: Image.Image,
    *,
    x_scale: float = 1.0,
    y_scale: float = 1.0,
    x_offset: int = 0,
    y_offset: int = 0,
    alpha: float = 1.0,
    brightness: float = 1.0,
    contrast: float = 1.0,
    color: float = 1.0,
    glow: tuple[int, int, int, int] | None = None,
    anchor: str = "baseline",
) -> Image.Image:
    bbox = alpha_bbox(frame)
    if not bbox:
        return Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))

    subject = frame.crop(bbox)
    size = (
        max(1, round(subject.width * x_scale)),
        max(1, round(subject.height * y_scale)),
    )
    subject = subject.resize(size, Image.Resampling.LANCZOS)

    subject_alpha = subject.getchannel("A")
    if alpha < 1:
        subject.putalpha(subject_alpha.point(lambda p: round(p * alpha)))

    rgb = subject.convert("RGB")
    rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
    rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    rgb = ImageEnhance.Color(rgb).enhance(color)
    subject = Image.merge("RGBA", (*rgb.split(), subject.getchannel("A")))

    canvas = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    x = (FRAME - subject.width) // 2 + x_offset
    if anchor == "center":
        y = (FRAME - subject.height) // 2 + y_offset
    else:
        y = BASELINE - subject.height + y_offset
    canvas.alpha_composite(subject, (x, y))

    if glow:
        r, g, b, strength = glow
        glow_layer = Image.new("RGBA", (FRAME, FRAME), (r, g, b, 0))
        glow_layer.putalpha(canvas.getchannel("A").filter(ImageFilter.GaussianBlur(4)).point(lambda p: min(strength, p // 5)))
        canvas = Image.alpha_composite(glow_layer, canvas)

    return canvas


def liquid_overlay(frame: Image.Image, *, index: int, name: str, variant: str) -> Image.Image:
    palette = VARIANTS[variant]
    alpha = frame.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return frame

    from PIL import ImageDraw

    overlay = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    glow_r, glow_g, glow_b, _ = palette["glow"]
    phase = index * 0.42
    cx = int((bbox[0] + bbox[2]) / 2 + sin(phase) * 18)
    cy = int((bbox[1] + bbox[3]) / 2 + 18 + sin(phase + 1.1) * 5)

    core_alpha = 36 if name.startswith("idle") else 48
    if "dispatch" in name or "busy" in name:
        core_alpha = 62
    draw.ellipse(
        (cx - 42, cy - 18, cx + 48, cy + 24),
        fill=(glow_r, glow_g, glow_b, core_alpha),
    )
    draw.arc(
        (bbox[0] + 18, bbox[1] + 14, bbox[2] - 22, bbox[3] + 24),
        start=196 + (index * 9) % 34,
        end=254 + (index * 9) % 34,
        fill=(245, 228, 162, 52),
        width=3,
    )
    if "dispatch" in name:
        wake_x = bbox[2] - 10 + min(28, index * 2)
        wake_y = int((bbox[1] + bbox[3]) / 2 + sin(phase + 0.6) * 5)
        draw.rounded_rectangle(
            (wake_x - 64, wake_y - 7, wake_x + 8, wake_y + 7),
            radius=8,
            fill=(glow_r, glow_g, glow_b, 42),
        )
        draw.rounded_rectangle(
            (wake_x - 94, wake_y + 11, wake_x - 22, wake_y + 19),
            radius=6,
            fill=(glow_r, glow_g, glow_b, 24),
        )
    overlay.putalpha(ImageChops.multiply(overlay.getchannel("A"), alpha.filter(ImageFilter.GaussianBlur(1))))
    return Image.alpha_composite(frame, overlay.filter(ImageFilter.GaussianBlur(0.35)))


def add_gold_spark(frame: Image.Image, x: int, y: int, radius: int, alpha: int = 190) -> Image.Image:
    canvas = frame.copy()
    spark = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    from PIL import ImageDraw

    draw = ImageDraw.Draw(spark)
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(196, 146, 44, alpha))
    draw.ellipse((x - radius // 3, y - radius // 3, x + radius // 3, y + radius // 3), fill=(255, 228, 122, min(255, alpha + 35)))
    spark = spark.filter(ImageFilter.GaussianBlur(1.2))
    return Image.alpha_composite(canvas, spark)


def tint_frame(frame: Image.Image, variant: str) -> Image.Image:
    palette = VARIANTS[variant]
    alpha = frame.getchannel("A")
    if not alpha.getbbox():
        return frame.copy()

    rgb = frame.convert("RGB")
    gray = ImageOps.grayscale(rgb)
    colorized = ImageOps.colorize(
        gray,
        black=palette["shadow"],
        mid=palette["mid"],
        white=palette["highlight"],
        blackpoint=0,
        midpoint=126,
        whitepoint=255,
    )
    mixed = Image.blend(rgb, colorized, palette["strength"])
    out = Image.merge("RGBA", (*mixed.split(), alpha))

    glow_r, glow_g, glow_b, glow_strength = palette["glow"]
    glow = Image.new("RGBA", frame.size, (glow_r, glow_g, glow_b, 0))
    glow.putalpha(alpha.filter(ImageFilter.GaussianBlur(4)).point(lambda p: min(glow_strength, p // 5)))
    return Image.alpha_composite(glow, out)


def state_frames(idle_frames: list[Image.Image]) -> dict[str, list[Image.Image]]:
    busy: list[Image.Image] = []
    reward: list[Image.Image] = []
    waiting: list[Image.Image] = []
    tired: list[Image.Image] = []
    failed: list[Image.Image] = []

    for index in range(16):
        source = idle_frames[index % len(idle_frames)]

        pulse = [0, 1, 2, 1, 0, -1, -2, -1][index % 8]
        busy.append(transform_frame(
            source,
            x_scale=0.98 + abs(pulse) * 0.012,
            y_scale=1.02 + abs(pulse) * 0.018,
            y_offset=-4 - abs(pulse),
            brightness=1.04,
            contrast=1.12,
            glow=(190, 134, 36, 42 + abs(pulse) * 9),
        ))

        reward_frame = transform_frame(
            source,
            x_scale=1.0,
            y_scale=1.0,
            y_offset=-2,
            brightness=1.06,
            contrast=1.06,
            color=1.06,
            glow=(190, 134, 36, 44),
        )
        orbit = [
            (258, 250, 6), (270, 234, 7), (268, 216, 6), (252, 204, 5),
            (226, 202, 6), (198, 212, 7), (184, 232, 6), (196, 252, 5),
        ][index % 8]
        reward.append(add_gold_spark(reward_frame, *orbit, alpha=165))

        waiting.append(transform_frame(
            source,
            x_scale=1.04,
            y_scale=0.9,
            y_offset=10 + (index % 4 in (1, 2)) * 2,
            alpha=0.92,
            brightness=0.9,
            contrast=0.96,
            color=0.82,
        ))

        tired.append(transform_frame(
            source,
            x_scale=1.14,
            y_scale=0.76,
            y_offset=22 + (index % 6 in (2, 3)) * 2,
            alpha=0.88,
            brightness=0.78,
            contrast=0.9,
            color=0.68,
        ))

        failed.append(transform_frame(
            source,
            x_scale=1.08,
            y_scale=0.72,
            x_offset=[-2, 2, -1, 1][index % 4],
            y_offset=25,
            alpha=0.72 if index % 4 else 0.62,
            brightness=0.56,
            contrast=0.82,
            color=0.46,
        ))

    return {
        "busy-sheet": busy,
        "reward-sheet": reward,
        "waiting-sheet": waiting,
        "tired-sheet": tired,
        "failed-sheet": failed,
    }


def refine_idle_frames(frames: list[Image.Image], count: int = 24) -> list[Image.Image]:
    refined: list[Image.Image] = []
    for index in range(count):
        source = frames[round(index * (len(frames) - 1) / max(1, count - 1))]
        phase = (index / count) * 2 * pi
        breath = sin(phase)
        secondary = sin(phase * 2.0 + 0.8)
        refined.append(transform_frame(
            source,
            x_scale=1.0 + breath * 0.014 + secondary * 0.006,
            y_scale=1.0 - breath * 0.014,
            x_offset=round(sin(phase + 1.4) * 2),
            y_offset=round(secondary * 1.5),
            brightness=1.0 + max(0, breath) * 0.02,
            contrast=1.02,
        ))
    return refined


def dispatch_frames(idle_frames: list[Image.Image], count: int = 24) -> list[Image.Image]:
    frames: list[Image.Image] = []
    for index in range(count):
        source = idle_frames[index % len(idle_frames)]
        t = index / max(1, count - 1)
        if t < 0.16:
            k = t / 0.16
            x_scale = 1.0 + 0.16 * k
            y_scale = 1.0 - 0.24 * k
            x_offset = round(2 * k)
            y_offset = round(13 * k)
        elif t < 0.42:
            k = (t - 0.16) / 0.26
            x_scale = 1.16 + 0.28 * k
            y_scale = 0.76 - 0.16 * k
            x_offset = round(2 + 20 * k)
            y_offset = round(13 + 10 * k)
        elif t < 0.62:
            k = (t - 0.42) / 0.20
            x_scale = 1.44 - 0.04 * k
            y_scale = 0.60 + 0.02 * k
            x_offset = round(22 - 4 * k)
            y_offset = 23
        elif t < 0.84:
            k = (t - 0.62) / 0.22
            x_scale = 1.40 - 0.32 * k
            y_scale = 0.62 + 0.30 * k
            x_offset = round(18 - 15 * k)
            y_offset = round(22 - 16 * k)
        else:
            k = (t - 0.84) / 0.16
            x_scale = 1.08 - 0.07 * k
            y_scale = 0.92 + 0.08 * k
            x_offset = round(3 - 3 * k)
            y_offset = round(6 - 6 * k)

        frames.append(transform_frame(
            source,
            x_scale=x_scale,
            y_scale=y_scale,
            x_offset=x_offset,
            y_offset=y_offset,
            brightness=1.03 + (0.06 if 0.16 <= t <= 0.72 else 0),
            contrast=1.08 + (0.08 if 0.16 <= t <= 0.72 else 0),
            color=1.04,
            glow=(190, 134, 36, 54 if 0.16 <= t <= 0.72 else 38),
        ))
    return frames


def save_sheet(name: str, frames: Iterable[Image.Image], out_dir: Path, variant: str) -> None:
    frames = [
        compose_frame(liquid_overlay(tint_frame(frame, variant), index=index, name=name, variant=variant))
        for index, frame in enumerate(frames)
    ]
    sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME, 0))
    sheet.save(out_dir / f"{name}.png")


def contact_sheet(name: str, frames: list[Image.Image], out_dir: Path, variant: str, cols: int = 8) -> None:
    thumb = 128
    rows = (len(frames) + cols - 1) // cols
    canvas = Image.new("RGBA", (cols * thumb, rows * thumb), (20, 20, 22, 255))
    from PIL import ImageDraw

    draw = ImageDraw.Draw(canvas)
    for index, frame in enumerate(frames):
        cell = compose_frame(
            liquid_overlay(tint_frame(frame, variant), index=index, name=name, variant=variant)
        ).resize((thumb, thumb), Image.Resampling.LANCZOS)
        x = (index % cols) * thumb
        y = (index // cols) * thumb
        canvas.alpha_composite(cell, (x, y))
        draw.rectangle((x, y, x + thumb - 1, y + thumb - 1), outline=(74, 64, 42, 255))
        draw.text((x + 5, y + 4), str(index), fill=(232, 193, 93, 255))
    canvas.save(out_dir / f"{name}-contact.png")


def variant_overview() -> None:
    labels = {
        "gray": ("COMMON", "SMOKY GRAY"),
        "black-gold": ("RARE", "BLACK GOLD"),
        "blue": ("RARE", "FROST BLUE"),
        "purple": ("EPIC", "VOID PURPLE"),
        "red": ("EPIC", "LAVA RED"),
        "silver": ("GENESIS", "LIQUID SILVER"),
    }
    card_w = 220
    card_h = 250
    gap = 18
    pad = 28
    canvas = Image.new(
        "RGBA",
        (pad * 2 + card_w * 3 + gap * 2, pad * 2 + card_h * 2 + gap),
        (12, 13, 15, 255),
    )
    from PIL import ImageDraw

    draw = ImageDraw.Draw(canvas)
    for index, variant in enumerate(VARIANTS):
        sheet = Image.open(OUT / variant / "idle-slime-sheet.png").convert("RGBA")
        frame = sheet.crop((0, 0, FRAME, FRAME)).resize((178, 178), Image.Resampling.LANCZOS)
        x = pad + (index % 3) * (card_w + gap)
        y = pad + (index // 3) * (card_h + gap)
        palette = VARIANTS[variant]
        glow_r, glow_g, glow_b, _ = palette["glow"]
        draw.rounded_rectangle(
            (x, y, x + card_w, y + card_h),
            radius=18,
            fill=(22, 24, 28, 255),
            outline=(glow_r, glow_g, glow_b, 135),
            width=2,
        )
        canvas.alpha_composite(frame, (x + 21, y + 20))
        rarity, name = labels[variant]
        draw.text((x + 18, y + 192), rarity, fill=(glow_r, glow_g, glow_b, 255))
        draw.text((x + 18, y + 214), name, fill=(235, 238, 242, 255))
    canvas.save(OUT / "bubble-variants-overview.png")


def ease_frames(
    source: list[Image.Image],
    indices: list[int],
    target_height: int = TARGET_HEIGHT,
    target_width: int = TARGET_WIDTH,
) -> list[Image.Image]:
    return [
        normalize_frame(source[index], target_height=target_height, target_width=target_width)
        for index in indices
    ]


def tap_frames(
    morph_source: list[Image.Image],
    indices: list[int],
    idle_frame: Image.Image,
    *,
    target_height: int = 214,
    target_width: int = 288,
    squash_x: float = 1.08,
    squash_y: float = 0.84,
) -> list[Image.Image]:
    morph_frames = ease_frames(
        morph_source,
        indices,
        target_height=target_height,
        target_width=target_width,
    )
    return [
        idle_frame,
        transform_frame(idle_frame, x_scale=squash_x, y_scale=squash_y, y_offset=14),
        *morph_frames,
        transform_frame(idle_frame, x_scale=1.04, y_scale=0.9, y_offset=8),
        idle_frame,
    ]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    idle_source = load_sheet(PUBLIC / "v2.1" / "idle-crawl-sheet.png")
    morph_source = load_sheet(PUBLIC / "v2" / "tap-morph-sheet.png")

    idle_indices = [0, 1, 2, 3, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
    round_indices = [2, 4, 6, 8, 8, 8, 8, 6, 4, 2]
    square_indices = [2, 9, 10, 11, 12, 13, 14, 15, 15, 15, 14, 13, 12, 11, 9, 2]
    triangle_indices = [30, 29, 28, 27, 26, 25, 24, 24, 24, 25, 26, 27, 28, 29, 30]
    idle_base = ease_frames(idle_source, idle_indices, target_height=190, target_width=324)
    refined_idle = refine_idle_frames(idle_base)

    outputs = {
        "idle-slime-sheet": refined_idle,
        "tap-round-sheet": tap_frames(morph_source, round_indices, refined_idle[0], squash_x=1.1, squash_y=0.82),
        "tap-square-sheet": tap_frames(morph_source, square_indices, refined_idle[0], squash_x=1.12, squash_y=0.8),
        "tap-triangle-sheet": tap_frames(morph_source, triangle_indices, refined_idle[0], squash_x=1.08, squash_y=0.84),
    }
    outputs["dispatch-sheet"] = dispatch_frames(outputs["idle-slime-sheet"])
    outputs.update(state_frames(outputs["idle-slime-sheet"]))

    for variant in VARIANTS:
        variant_out = OUT / variant
        variant_out.mkdir(parents=True, exist_ok=True)
        for name, frames in outputs.items():
            save_sheet(name, frames, variant_out, variant)
            contact_sheet(name, frames, variant_out, variant)
    variant_overview()

    reference = Path("/Users/yu1/.codex/generated_images/019f1789-a43d-7cd1-ade4-af84fbd4c0d8/ig_062bd3d9bb732a98016a4513810dd081909d76c97e64fd685d.png")
    if reference.exists():
        Image.open(reference).convert("RGBA").save(OUT / "dark-bubble-v3-concept-reference-source.png")


if __name__ == "__main__":
    main()
