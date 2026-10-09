# 会員カードの写真の「てかり」（右側、とくに右下が白っぽく浮いている）を取る。
# てかりは光の反射が上に足されたもの。黒い地の明るさのなだらかな偏りを求めて、その分を画像全体から引く。
# 引き算は「光の量」に直してから行う（画像の数値のまま引くと、赤い文字まで暗くなりすぎる）。
#   python3 deglare.py        … ../assets/card.jpg を作り直し、../src/card.js に埋め込む
# 元の写真（../assets/card-src.jpg）が必要。写真そのものはリポジトリには入れていない。
#   python3 deglare.py dry    … 数値を出すだけで、ファイルは書き換えない
import sys, base64, numpy as np, cv2
SRC = '../assets/card-src.jpg'
QUAD = np.float32([(83, 101), (1435, 97), (1459, 936), (83, 967)])      # 写真の中のカードの四隅
W, H = 856, 540
src = cv2.imread(SRC)
M = cv2.getPerspectiveTransform(QUAD, np.float32([(0, 0), (W, 0), (W, H), (0, H)]))
im = cv2.warpPerspective(src, M, (W, H), flags=cv2.INTER_AREA).astype(np.float32)      # B, G, R

def background(img):
    """黒い地だけを選ぶ（文字・帯・磁気ストライプ・角の外・ふちを除く）"""
    b, g, r = img[..., 0], img[..., 1], img[..., 2]
    dark = (img.max(2) < 100) & (r - b < 6) & (r - g < 8)
    ink = cv2.dilate((~dark).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0             # 文字のにじみを避ける
    m = dark & ~ink
    m[:, :10] = m[:, -10:] = False; m[:8] = m[-8:] = False
    m[52:124] = False                                                                       # 磁気ストライプ（地の色が違う）
    yy, xx = np.mgrid[0:H, 0:W]; rad = 34                                                   # 角の丸みの外
    for cx, cy in ((rad, rad), (W - rad, rad), (rad, H - rad), (W - rad, H - rad)):
        corner = (abs(xx - cx) <= rad) & (abs(yy - cy) <= rad) & ((xx < rad) | (xx > W - rad)) & ((yy < rad) | (yy > H - rad))
        m[corner & ((xx - cx) ** 2 + (yy - cy) ** 2 > (rad - 8) ** 2)] = False
    return m

def fit_field(img, mask, deg=3):
    """地の明るさのなだらかな偏りを、x・y の多項式で求める（色ごと）"""
    yy, xx = np.mgrid[0:H, 0:W]; u = xx / W * 2 - 1; v = yy / H * 2 - 1
    terms = [u ** i * v ** j for i in range(deg + 1) for j in range(deg + 1 - i)]
    A = np.stack([t[mask] for t in terms], 1); full = np.stack([t.ravel() for t in terms], 1)
    out = np.zeros_like(img)
    for c in range(3):
        y = img[..., c][mask]; w = np.ones_like(y)
        for _ in range(4):                                                                  # 外れ値（ほこり・傷）に引っぱられないよう重みを付け直す
            coef = np.linalg.lstsq(A * w[:, None], y * w, rcond=None)[0]; res = y - A @ coef
            s = np.median(np.abs(res)) * 1.4826 + 1e-6; w = 1 / np.maximum(1, np.abs(res) / (2.5 * s))
        out[..., c] = (full @ coef).reshape(H, W)
    return out

def to_linear(v): v = v / 255.0; return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
def to_srgb(l): l = np.clip(l, 0, 1); return np.where(l <= 0.0031308, l * 12.92, 1.055 * l ** (1 / 2.4) - 0.055) * 255.0
def smooth_masked(a, mask, sigma):
    """mask の画素だけを使ったぼかし（文字の下は周りの地から補う）"""
    w = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), sigma) + 1e-6
    return np.stack([cv2.GaussianBlur(a[..., c] * mask, (0, 0), sigma) / w for c in range(3)], 2)

def deglare(img):
    mask = background(img); lin = to_linear(img)
    field = fit_field(lin, mask)                                           # 大きな偏り
    field = field + smooth_masked(lin - field, mask, 40)                   # 多項式で取りきれない、ゆるい偏り
    ref = np.array([np.median(field[..., c][130:520, 40:260][mask[130:520, 40:260]]) for c in range(3)])   # 左側の地を基準にする
    glare = np.maximum(field - ref, 0)
    out = lin - glare
    # てかった所は表面のざらつきも光って見える。地の部分だけ、ざらつきを左側と同じ強さまで弱める
    amount = glare.mean(2); res = out - ref
    bins = [(lo, hi) for lo, hi in ((0, .002), (.002, .005), (.005, .008), (.008, .012), (.012, .05)) if (mask & (amount >= lo) & (amount < hi)).sum() > 800]
    xs = [float(amount[mask & (amount >= lo) & (amount < hi)].mean()) for lo, hi in bins]
    ys = [float(np.std(res[mask & (amount >= lo) & (amount < hi)])) for lo, hi in bins]
    k1, k0 = np.polyfit(xs, ys, 1); base = ys[0]
    gain = np.clip(base / np.maximum(k0 + k1 * amount, base), 0.35, 1)     # 1 = そのまま
    # 「なだらかな成分」は地の画素だけから作る（文字の色を地ににじませない）。効かせるのも地の内側だけ
    inner = cv2.erode(mask.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
    soft = cv2.GaussianBlur(inner, (0, 0), 2.0)[..., None]
    low = smooth_masked(out, mask, 5)
    out = out * (1 - soft) + (low + (out - low) * gain[..., None]) * soft
    return to_srgb(out), dict(mask=mask, ref=to_srgb(ref), glare_max=float(amount.max()), rough=list(zip(np.round(xs, 4), np.round(np.array(ys) * 1000, 2))))

def flatness(img, mask, label):
    """地の色を 6×4 のますで測る（R の値。左と右でそろっていれば成功）"""
    rows = []
    for j in range(4):
        row = []
        for i in range(6):
            x0, x1, y0, y1 = i * W // 6, (i + 1) * W // 6, 124 + j * (H - 124) // 4, 124 + (j + 1) * (H - 124) // 4
            m = mask[y0:y1, x0:x1]; row.append('%5.1f' % np.median(img[y0:y1, x0:x1][m].mean(1)) if m.sum() > 200 else '   – ')
        rows.append(' '.join(row))
    print(label); print('\n'.join('   ' + r for r in rows))

if __name__ == '__main__':
    out, info = deglare(im); mask = info['mask']
    print('地の色（基準）R/G/B', np.round(info['ref'][::-1], 1), ' ざらつき（てかり量, 強さ）', info['rough'])
    flatness(im, mask, '直す前: 地の明るさ（左→右）'); flatness(out, mask, '直した後:')
    for name, (x0, y0, x1, y1) in (('D の赤（左）', (50, 340, 70, 420)), ('7 の横棒の赤', (720, 250, 780, 290)), ('7 の軸の赤', (690, 380, 720, 420))):
        print('  %s  前 %s → 後 %s' % (name, np.round(np.median(im[y0:y1, x0:x1].reshape(-1, 3), 0)[::-1]), np.round(np.median(out[y0:y1, x0:x1].reshape(-1, 3), 0)[::-1])))
    res8 = np.clip(np.round(out), 0, 255).astype(np.uint8)
    cv2.imwrite('card-after.png', res8); cv2.imwrite('card-before.png', np.clip(np.round(im), 0, 255).astype(np.uint8))
    if 'dry' in sys.argv: sys.exit()
    ok, buf = cv2.imencode('.jpg', res8, [cv2.IMWRITE_JPEG_QUALITY, 86, cv2.IMWRITE_JPEG_OPTIMIZE, 1]); assert ok
    open('../assets/card.jpg', 'wb').write(buf.tobytes())
    open('../src/card.js', 'w').write("const CARD_MAIN = 'data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode() + "';\n")
    print('card.jpg', len(buf), 'bytes')
