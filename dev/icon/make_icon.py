# ホーム画面アイコン「D7E」。
# 文字の形は、会員カードのロゴ（DELUXE7）から D・E・7 を切り抜いて測った寸法をなぞったもの。
# 写真そのままだとふちが波打つので、測った寸法どおりの直線と円弧で描き直している。
# 大きい 7 を中央に立て、その斜めの軸の左に D、右（横棒の下）に E。3文字とも下端をそろえる。
#   python3 make_icon.py        … ../static/ の3サイズ（180・192・512）を書き出す。A案（赤い文字に金のふち）
#   python3 make_icon.py mix    … B案（D と E を白）で書き出す
#   python3 make_icon.py both   … 2案を並べた確認用の画像 compare.png だけを書き出す
# 必要なもの: numpy, opencv-python, pillow
import sys, math, numpy as np, cv2
from PIL import Image, ImageDraw

# ── 文字の形（単位はカードを4倍に拡大した画像の画素。外側の多角形と、くり抜く穴）
def glyph_D():                                       # 高さ445・幅402、線の太さ約113、右の角は大きな円弧
    W, H, R = 402.0, 445.0, 104.0
    arc = lambda cx, cy, a0, a1: [(cx + R*math.cos(math.radians(a)), cy + R*math.sin(math.radians(a))) for a in np.linspace(a0, a1, 40)]
    outer = [(0, 0)] + arc(W - R, R, -90, 0) + arc(W - R, H - R, 0, 90) + [(0, H)]
    return (W, H), [outer], [[(114, 112), (286, 112), (286, 333), (114, 333)]]
def glyph_E():                                       # 高さ445・幅306、横棒3本は同じ長さ
    W, H = 306.0, 445.0
    outer = [(0, 0), (W, 0), (W, 107), (108, 107), (108, 167), (W, 167), (W, 277), (108, 277), (108, 337), (W, 337), (W, H), (0, H)]
    return (W, H), [outer], []
def glyph_7():                                       # 高さ821・幅726、軸の傾きは縦1に対して横0.57
    W, H, bar, stem, k = 726.0, 821.0, 194.0, 233.0, 0.57
    xr = lambda y: W - k*y
    return (W, H), [[(0, 0), (W, 0), (xr(H), H), (xr(H) - stem, H), (xr(bar) - stem, bar), (0, bar)]], []
CORNER = 9.0                                         # 角の丸み（同じ単位）

def draw(size, glyph, scale, ox, oy):
    """文字を size×size のマスクに描く。scale は 1単位あたりの画素数、(ox, oy) は左上の位置"""
    (_, _), outers, holes = glyph
    m = np.zeros((size, size), np.uint8); S = 16     # 1/16 画素きざみで描く
    pts = lambda p: np.round((np.array(p) * scale + (ox, oy)) * S).astype(np.int32)
    for p in outers: cv2.fillPoly(m, [pts(p)], 255, lineType=cv2.LINE_AA, shift=4)
    for p in holes: cv2.fillPoly(m, [pts(p)], 0, lineType=cv2.LINE_AA, shift=4)
    a = cv2.GaussianBlur(m.astype(np.float32), (0, 0), CORNER * scale * 0.55)   # 角を丸める
    return (a > 127.5).astype(np.uint8)
def dil(m, r): return cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*r+1, 2*r+1)))

def layout(ratio, gapk, L=2400, H7=1200):
    """7 の高さを 1 としたときの各文字の位置を返す。D と E は 7 にぶつかる手前まで寄せる"""
    G7, GD, GE = glyph_7(), glyph_D(), glyph_E()
    s7 = H7 / G7[0][1]; hh = H7 * ratio; sd = hh / GD[0][1]; se = hh / GE[0][1]
    x7, top = 800, 100; base = top + H7
    block = dil(draw(L, G7, s7, x7, top), round(H7 * gapk))
    def slide(g, s, start, step):
        x = start
        while not (block & draw(L, g, s, x, base - hh)).any(): x += step
        return x - step
    xd = slide(GD, sd, x7 - GD[0][0]*sd - 300, 3)                   # 左から寄せる
    xe = slide(GE, se, x7 + G7[0][0]*s7 + 100, -3)                  # 右から寄せる
    left = min(xd, x7); right = max(xe + GE[0][0]*se, x7 + G7[0][0]*s7)
    u = lambda v: v / H7
    return dict(w=u(right - left), h=1.0, x7=u(x7 - left), xd=u(xd - left), xe=u(xe - left), hh=ratio)

N = 4096                                             # 描く大きさ。最後に縮める
def render(style='red', ratio=0.47, gapk=0.062, boxw=0.80, boxh=0.66):
    G7, GD, GE = glyph_7(), glyph_D(), glyph_E(); lay = layout(ratio, gapk)
    H7 = min(boxw * N / lay['w'], boxh * N)          # 7 の高さ（画素）
    x0 = (N - lay['w'] * H7) / 2; y0 = (N - H7) / 2; hh = H7 * lay['hh']
    F7 = draw(N, G7, H7 / G7[0][1], x0 + lay['x7'] * H7, y0)
    FS = draw(N, GD, hh / GD[0][1], x0 + lay['xd'] * H7, y0 + H7 - hh) | draw(N, GE, hh / GE[0][1], x0 + lay['xe'] * H7, y0 + H7 - hh)
    fill = F7 | FS; stroke = round(N * 0.011)
    yy = np.linspace(0, 1, N, dtype=np.float32)[:, None, None]
    cx, cy = np.meshgrid(np.linspace(-1, 1, N, dtype=np.float32), np.linspace(-1, 1, N, dtype=np.float32))
    glow = np.clip(1 - ((cx*0.9)**2 + ((cy+0.15)*1.1)**2), 0, 1)[..., None] ** 1.6
    img = np.array([9, 9, 10], np.float32) + glow * np.array([22, 21, 23], np.float32)     # 黒地。中央だけわずかに明るい
    t = np.clip((yy - y0/N) / (H7/N), 0, 1)
    grad = lambda a, b: np.broadcast_to((1 - t) * np.array(a, np.float32) + t * np.array(b, np.float32), (N, N, 3))
    red, gold, white = grad([228, 44, 54], [160, 20, 32]), grad([240, 214, 148], [188, 150, 80]), grad([250, 250, 248], [204, 204, 202])
    paint = lambda img, mask, col: np.where(mask[..., None] > 0, col, img)
    if style == 'red':                               # カードと同じ: 赤い文字に金のふち
        img = paint(img, dil(fill, stroke), gold); img = paint(img, fill, red)
    else:                                            # 7 だけ赤、D と E は白
        img = paint(img, FS, white); img = paint(img, dil(F7, stroke), gold); img = paint(img, F7, red)
    return Image.fromarray(img.clip(0, 255).astype(np.uint8), 'RGB')

def homescreen(icons, labels, path):                 # iPhone の角丸をかけた見え方
    from PIL import ImageFont
    s = 460; pad = 60; head = 90 if any(labels) else 0
    prev = Image.new('RGB', (pad + (s + pad) * len(icons), head + s + 2*pad + 150), (30, 32, 38)); dr = ImageDraw.Draw(prev)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 56)
    except OSError: font = ImageFont.load_default()
    for i, big in enumerate(icons):
        x = pad + i * (s + pad)
        if labels[i]: dr.text((x + 4, 30), labels[i], fill=(236, 236, 232), font=font)
        for size, yy, xx in ((s, head + pad, x), (120, head + s + pad + 24, x), (60, head + s + pad + 54, x + 150)):
            ic = big.resize((size, size), Image.LANCZOS); mk = Image.new('L', (size*4, size*4), 0)
            ImageDraw.Draw(mk).rounded_rectangle([0, 0, size*4-1, size*4-1], radius=int(size*4*0.225), fill=255)
            prev.paste(ic, (xx, yy), mk.resize((size, size), Image.LANCZOS))
    prev.save(path)

if __name__ == '__main__':
    style = sys.argv[1] if len(sys.argv) > 1 else 'red'
    if style == 'both':
        a, b = render('red'), render('mix'); homescreen([a, b], ['A', 'B'], 'compare.png')
    else:
        big = render(style)
        for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
            big.resize((size, size), Image.LANCZOS).save('../static/' + name, optimize=True)
