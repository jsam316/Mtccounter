#!/usr/bin/env python3
"""Generate app icons for MTC Counter - light, dark, and tinted modes."""

from PIL import Image, ImageDraw, ImageFilter
import os
import math

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def draw_church_icon(size=1024, mode="light"):
    """Draw the church icon for the given mode: 'light', 'dark', or 'tinted'."""
    s = size
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ---- Color Palettes ----
    if mode == "dark":
        bg_top      = (22, 34, 58)
        bg_bot      = (18, 28, 50)
        body_fill   = (210, 170, 115)
        roof_fill   = (68, 162, 205)
        roof_hi     = (95, 185, 225)
        roof_shadow = (35, 110, 155)
        cross_fill  = (255, 255, 255)
        door_fill   = (145, 92, 40)
        win_fill    = (55, 140, 185)
        base_fill   = (60, 148, 192)
        base_shadow = (30, 100, 145)
        body_shadow = (165, 130, 85)
    else:  # light / tinted source
        bg_top      = (130, 192, 222)
        bg_bot      = (100, 170, 205)
        body_fill   = (238, 200, 138)
        roof_fill   = (46, 128, 170)
        roof_hi     = (75, 158, 198)
        roof_shadow = (28, 95, 135)
        cross_fill  = (255, 255, 255)
        door_fill   = (138, 88, 32)
        win_fill    = (46, 128, 170)
        base_fill   = (46, 128, 170)
        base_shadow = (28, 95, 135)
        body_shadow = (195, 158, 98)

    corner_r = int(s * 0.225)

    # ---- Background gradient (simulate with two-tone) ----
    for y in range(s):
        t = y / s
        row_color = lerp_color(bg_top, bg_bot, t)
        draw.line([(0, y), (s, y)], fill=row_color)
    # Mask to rounded rect
    mask = Image.new('L', (s, s), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=corner_r, fill=255)
    img.putalpha(mask)

    draw = ImageDraw.Draw(img)

    # Helper: draw arch shape
    def arch(x, y, w, h, fill):
        r = w // 2
        draw.rectangle([x, y + r, x + w, y + h], fill=fill)
        draw.ellipse([x, y, x + w, y + w], fill=fill)

    sd = int(s * 0.018)  # shadow offset

    # ---- BASE PLATFORM (two tiers) ----
    base_w  = int(s * 0.620)
    base_h  = int(s * 0.062)
    base_y  = int(s * 0.836)
    base_x  = (s - base_w) // 2

    step_w  = int(s * 0.520)
    step_h  = int(s * 0.040)
    step_x  = (s - step_w) // 2
    step_y  = base_y - step_h

    # shadows
    draw.rectangle([base_x + sd, base_y + sd, base_x + base_w + sd, base_y + base_h + sd], fill=base_shadow)
    draw.rectangle([step_x + sd, step_y + sd, step_x + step_w + sd, step_y + step_h + sd], fill=base_shadow)
    # fill
    draw.rectangle([base_x, base_y, base_x + base_w, base_y + base_h], fill=base_fill)
    draw.rectangle([step_x, step_y, step_x + step_w, step_y + step_h], fill=base_fill)
    # top highlight
    hi = roof_hi
    draw.line([(base_x, base_y), (base_x + base_w, base_y)], fill=hi, width=max(2, int(s * 0.003)))

    # ---- MAIN BODY ----
    body_w  = int(s * 0.500)
    body_h  = int(s * 0.385)
    body_x  = (s - body_w) // 2
    body_y  = step_y - body_h

    draw.rectangle([body_x + sd, body_y + sd, body_x + body_w + sd, body_y + body_h + sd], fill=body_shadow)
    draw.rectangle([body_x, body_y, body_x + body_w, body_y + body_h], fill=body_fill)

    # ---- MAIN ROOF ----
    ro = int(s * 0.042)  # overhang
    roof_apex_y = int(s * 0.305)
    roof_pts = [
        (body_x - ro, body_y),
        (body_x + body_w + ro, body_y),
        (s // 2, roof_apex_y),
    ]
    shadow_pts = [(x + sd, y + sd) for x, y in roof_pts]
    draw.polygon(shadow_pts, fill=roof_shadow)
    draw.polygon(roof_pts, fill=roof_fill)
    # highlight edges
    draw.line([roof_pts[0], roof_pts[2]], fill=roof_hi, width=max(3, int(s * 0.005)))
    draw.line([roof_pts[1], roof_pts[2]], fill=roof_hi, width=max(3, int(s * 0.005)))

    # ---- STEEPLE / TOWER ----
    tow_w   = int(s * 0.190)
    tow_h   = int(s * 0.185)
    tow_x   = (s - tow_w) // 2
    tow_y   = int(s * 0.288)

    draw.rectangle([tow_x + sd, tow_y + sd, tow_x + tow_w + sd, tow_y + tow_h + sd], fill=body_shadow)
    draw.rectangle([tow_x, tow_y, tow_x + tow_w, tow_y + tow_h], fill=body_fill)

    # Tower roof
    tro = int(s * 0.022)
    tr_apex_y = int(s * 0.148)
    tr_pts = [
        (tow_x - tro, tow_y),
        (tow_x + tow_w + tro, tow_y),
        (s // 2, tr_apex_y),
    ]
    tr_shadow_pts = [(x + sd, y + sd) for x, y in tr_pts]
    draw.polygon(tr_shadow_pts, fill=roof_shadow)
    draw.polygon(tr_pts, fill=roof_fill)
    draw.line([tr_pts[0], tr_pts[2]], fill=roof_hi, width=max(2, int(s * 0.004)))
    draw.line([tr_pts[1], tr_pts[2]], fill=roof_hi, width=max(2, int(s * 0.004)))

    # ---- CROSS ----
    cx      = s // 2
    ct      = int(s * 0.068)
    cv_h    = int(s * 0.086)
    cv_w    = int(s * 0.026)
    ch_w    = int(s * 0.072)
    ch_h    = int(s * 0.026)
    ch_y    = ct + int(cv_h * 0.375)
    draw.rectangle([cx - cv_w // 2, ct, cx + cv_w // 2, ct + cv_h], fill=cross_fill)
    draw.rectangle([cx - ch_w // 2, ch_y - ch_h // 2, cx + ch_w // 2, ch_y + ch_h // 2], fill=cross_fill)

    # ---- MAIN DOOR (ARCHED) ----
    dw = int(s * 0.130)
    dh = int(s * 0.225)
    dx = (s - dw) // 2
    db = body_y + body_h          # door bottom aligns with body bottom
    dy = db - dh

    arch(dx, dy, dw, dh, win_fill)

    # Wooden double-door panels
    pad  = int(dw * 0.08)
    wr   = dw // 2
    wy   = dy + wr + int(pad * 1.2)  # start below arch
    wbot = db - pad
    gap  = max(2, int(dw * 0.05))
    draw.rectangle([dx + pad,        wy, dx + dw // 2 - gap, wbot], fill=door_fill)
    draw.rectangle([dx + dw // 2 + gap, wy, dx + dw - pad, wbot], fill=door_fill)
    # Door handle dots
    hx = dx + dw // 4 * 3 - gap // 2
    hy = (wy + wbot) // 2
    hr = max(2, int(s * 0.005))
    draw.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=win_fill)
    hx2 = dx + dw // 4 + gap // 2
    draw.ellipse([hx2 - hr, hy - hr, hx2 + hr, hy + hr], fill=win_fill)

    # ---- SIDE WINDOWS (ARCHED) ----
    wn_w   = int(s * 0.082)
    wn_h   = int(s * 0.135)
    wn_y   = body_y + int(body_h * 0.225)

    lw_x = body_x + int(body_w * 0.100)
    arch(lw_x, wn_y, wn_w, wn_h, win_fill)

    rw_x = body_x + body_w - int(body_w * 0.100) - wn_w
    arch(rw_x, wn_y, wn_w, wn_h, win_fill)

    return img


def to_grayscale_icon(img):
    """Convert icon to grayscale (for tinted mode - iOS applies its own tint)."""
    gray = img.convert('LA').convert('RGBA')
    return gray


def save_icon(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, 'PNG', optimize=True)
    print(f"  Saved: {path}")


if __name__ == "__main__":
    base = "/home/user/Mtccounter"
    ios_dir   = f"{base}/MtcCounter/Assets.xcassets/AppIcon.appiconset"
    watch_dir = f"{base}/MtcCounterWatch Watch App/Assets.xcassets/AppIcon.appiconset"

    print("Generating icons...")

    # Light (system)
    light = draw_church_icon(1024, "light")
    save_icon(light, f"{ios_dir}/AppIcon.png")

    # Dark
    dark = draw_church_icon(1024, "dark")
    save_icon(dark, f"{ios_dir}/AppIcon-dark.png")

    # Tinted (grayscale so iOS can tint it)
    tinted = to_grayscale_icon(light)
    save_icon(tinted, f"{ios_dir}/AppIcon-tinted.png")

    # watchOS (single 1024x1024 per size slot, share light icon)
    save_icon(light, f"{watch_dir}/AppIcon.png")
    save_icon(dark,  f"{watch_dir}/AppIcon-dark.png")

    print("Done.")
