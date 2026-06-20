"""
Generates icons/icon16.png, icons/icon48.png, icons/icon128.png
using only Python stdlib (no Pillow needed).
Design: green rounded background with a white tab-stack symbol.
"""
import os, struct, zlib

def make_png(size):
    """Return bytes of a valid PNG with the icon drawn at `size` x `size`."""
    px = [[(0, 0, 0, 0)] * size for _ in range(size)]  # RGBA rows

    # ── Colours ──────────────────────────────────────────────────────────────
    BG   = (46, 125, 50, 255)    # #2e7d32 green
    TAB  = (255, 255, 255, 255)  # white
    TABB = (200, 230, 201, 255)  # light green for back tabs

    # ── Helpers ──────────────────────────────────────────────────────────────
    def fill(r, c, h, w, colour):
        for y in range(max(0, r), min(size, r + h)):
            for x in range(max(0, c), min(size, c + w)):
                px[y][x] = colour

    def circle_fill(colour, radius=None):
        """Fill a circle centred in the image."""
        cx = cy = size / 2
        r  = radius if radius else size / 2
        for y in range(size):
            for x in range(size):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2:
                    px[y][x] = colour

    # ── Draw ─────────────────────────────────────────────────────────────────
    s = size
    circle_fill(BG)

    if s <= 16:
        # 16 px: two small rectangles (tabs)
        m = 2
        fill(m, m,       5, s - m*2 - 2, TABB)   # back tab body
        fill(m, m,       2, (s - m*2)//2, TABB)   # back tab ear
        fill(m+3, m,     5, s - m*2,     TAB)     # front tab body
        fill(m+3, m,     2, (s - m*2)//2,TAB)
    elif s <= 48:
        # 48 px
        m  = int(s * 0.12)
        bh = int(s * 0.45)  # body height
        ew = int(s * 0.30)  # ear width
        eh = int(s * 0.12)  # ear height
        oy = int(s * 0.18)  # back-tab y offset

        fill(oy,      m,      bh, s-m*2-4, TABB)
        fill(oy,      m,      eh, ew,      TABB)

        fill(oy+8,    m,      bh, s-m*2,   TAB)
        fill(oy+8,    m,      eh, ew,      TAB)
    else:
        # 128 px
        m  = int(s * 0.12)
        bh = int(s * 0.40)
        ew = int(s * 0.28)
        eh = int(s * 0.10)
        oy = int(s * 0.20)

        fill(oy,      m,      bh, s-m*2-8, TABB)
        fill(oy,      m,      eh, ew,      TABB)

        fill(oy+14,   m,      bh, s-m*2,   TAB)
        fill(oy+14,   m,      eh, ew,      TAB)

    # ── Encode PNG ───────────────────────────────────────────────────────────
    def png_chunk(tag, data):
        c = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', c)

    raw = b''
    for row in px:
        raw += b'\x00'  # filter byte
        for r, g, b, a in row:
            raw += bytes([r, g, b, a])

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2 | 4, 0, 0, 0)  # 8-bit RGBA
    # bit depth=8, colour type=6 (RGBA)
    ihdr = struct.pack('>II', size, size) + bytes([8, 6, 0, 0, 0])
    idat = zlib.compress(raw)

    return (
        b'\x89PNG\r\n\x1a\n'
        + png_chunk(b'IHDR', ihdr)
        + png_chunk(b'IDAT', idat)
        + png_chunk(b'IEND', b'')
    )


os.makedirs('icons', exist_ok=True)
for size in (16, 48, 128):
    path = f'icons/icon{size}.png'
    with open(path, 'wb') as f:
        f.write(make_png(size))
    print(f'Created {path}')

print('Done.')
