# 스테이크 외 음식 사진 가공: 배경 제거(rembg)·색 보정·텍스처 크롭 → www/assets/food/*.webp
# 사용: python3 tools/assets/build_food.py <원본폴더> [항목...]
import sys, os
import numpy as np
from PIL import Image, ImageFilter

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/assets'
ONLY = set(sys.argv[2:])
OUT = os.path.join(os.path.dirname(__file__), '../../www/assets/food')
os.makedirs(OUT, exist_ok=True)
_sess = None

def cutout(im):
    global _sess
    from rembg import remove, new_session
    if _sess is None: _sess = new_session('u2net')
    return remove(im.convert('RGB'), session=_sess)

def arr(im): return np.asarray(im, np.float32)
def img(a): return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def sat_mask(a, lo=0.16, hi=0.3):
    """흰 접시(채도 낮음)를 걷어내는 마스크"""
    rgb = a[..., :3] / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    s = (mx - mn) / np.maximum(mx, 1e-3)
    return np.clip((s - lo) / (hi - lo), 0, 1)

def trim_save(rgba, name, maxw):
    bb = rgba.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    if bb: rgba = rgba.crop(bb)
    if rgba.width > maxw: rgba = rgba.resize((maxw, round(rgba.height * maxw / rgba.width)), Image.LANCZOS)
    rgba.save(f'{OUT}/{name}.webp', quality=86, method=6)
    print(name, rgba.size, os.path.getsize(f'{OUT}/{name}.webp') // 1024, 'KB')

def soften_alpha(rgba, r=1.2):
    a = rgba.getchannel('A').filter(ImageFilter.GaussianBlur(r))
    rgba.putalpha(a); return rgba

def job(name):
    return not ONLY or name in ONLY

# ── 파스타 둥지 ──
if job('pasta'):
    # 알리오 올리오: 흰 접시째 잘려 나오므로 채도 마스크로 접시를 걷어냄
    a = arr(cutout(Image.open(f'{SRC}/orig-pasta-14.jpg').crop((60, 0, 1220, 900))))
    m = img(sat_mask(a, 0.2, 0.34) * 255).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(3))
    a[..., 3] *= np.clip(arr(m) / 255 * 1.5 - 0.25, 0, 1)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    e = np.sqrt(((xx - 585) / 515) ** 2 + ((yy - 440) / 400) ** 2)  # 접시 안쪽 타원
    a[..., 3] *= np.clip((1 - e) / 0.06, 0, 1)
    rgba = soften_alpha(img(a).convert('RGBA'), 0.8)
    trim_save(rgba, 'pasta_aglio', 720)
    # 토마토 소스: 같은 면에 토마토 소스 색을 입힘 (밝은 면은 덜, 어두운 틈은 진하게)
    t = arr(rgba)
    lum = t[..., :3].mean(-1, keepdims=True) / 255
    sauce = np.array([222, 92, 44], np.float32)
    k = 0.28 + 0.3 * (1 - lum)  # 방울토마토·면수로 만든 가벼운 소스: 면 색이 비치게
    t[..., :3] = t[..., :3] * (1 - k) + (sauce * (0.55 + 0.6 * lum)) * k
    trim_save(img(t).convert('RGBA'), 'pasta_tomato', 720)
    # 카르보나라: 종이 그릇 → 면만
    a = arr(cutout(Image.open(f'{SRC}/orig-carbo-5.jpg')))
    a[..., 3] *= np.maximum(sat_mask(a, 0.1, 0.2), 0)
    trim_save(soften_alpha(img(a).convert('RGBA'), 0.8), 'pasta_carbonara', 720)

def ellipse_alpha(w, h, cx, cy, rx, ry, feather=0.04):
    yy, xx = np.mgrid[0:h, 0:w]
    e = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    return np.clip((1 - e) / feather, 0, 1)

def save_jpg(im, name, maxw):
    if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.convert('RGB').save(f'{OUT}/{name}.jpg', quality=86)
    print(name, im.size, os.path.getsize(f'{OUT}/{name}.jpg') // 1024, 'KB')

def inpaint(a, mask, iters=40):
    """마스크 부분을 주변 색으로 채움 (반복 확산)"""
    a = a.copy()
    known = (1 - mask.astype(np.float32))
    col = a[..., :3] * known[..., None]
    for _ in range(iters):
        cb = np.asarray(img(col).filter(ImageFilter.BoxBlur(3)), np.float32)
        kb = np.asarray(img(known * 255).filter(ImageFilter.BoxBlur(3)), np.float32)[..., None] / 255
        grow = (known < 0.5) & (kb[..., 0] > 0.05)
        col[grow] = (cb / np.maximum(kb, 1e-3))[grow]
        known[grow] = 1
    a[..., :3] = np.where(mask[..., None], col, a[..., :3])
    return a

# ── 감바스 알 아히요 (무쇠 팬째) ──
if job('gambas'):
    src = Image.open(f'{SRC}/orig-gambas-12.jpg').convert('RGB')
    cx, cy, r = 930, 655, 530
    a = arr(src.crop((cx - r, cy - r, cx + r, cy + r)))
    al = ellipse_alpha(2 * r, 2 * r, r, r, r, r * 0.985, 0.02)
    full = np.dstack([a, al * 255])
    trim_save(img(full).convert('RGBA'), 'gambas', 640)
    # 파슬리를 준비하지 않았을 때: 초록 잎을 주변 기름색으로 지움
    rgb = a / 255
    green = ((rgb[..., 1] > rgb[..., 0] * 1.02) & (rgb[..., 1] > rgb[..., 2] * 1.1)) | ((rgb[..., 1] - rgb[..., 0] > -0.02) & (rgb.max(-1) < 0.35) & (rgb[..., 1] > rgb[..., 2] * 1.3))
    gm = np.asarray(img(green * 255.0).filter(ImageFilter.MaxFilter(7)), np.float32) / 255 > 0.5
    gm &= ellipse_alpha(2 * r, 2 * r, r, r, r * 0.86, r * 0.86, 0.01) > 0.5
    np_ = inpaint(np.dstack([a, al * 255]), gm)
    trim_save(img(np_).convert('RGBA'), 'gambas_plain', 640)

# ── 질감 타일: 새우 살, 랍스터 껍질·살 ──
if job('tex'):
    sh = Image.open(f'{SRC}/orig-gambas-2.jpg').convert('RGB').crop((600, 740, 840, 940))
    save_jpg(sh, 'shrimp_flesh', 240)
    # 생새우: 반투명한 회청색 (주황 줄무늬 → 짙은 회색 결)
    s = arr(sh); lum = s.mean(-1, keepdims=True)
    raw = lum * np.array([0.78, 0.84, 0.9]) + (s[..., :1] - s[..., 2:3]) * np.array([-0.15, -0.05, 0.05]) + 18
    save_jpg(img(raw), 'shrimp_raw', 240)
    lo = Image.open(f'{SRC}/orig-lobster-13.jpg').convert('RGB').crop((560, 400, 940, 495))
    save_jpg(lo, 'lobster_shell', 380)
    # 생 랍스터 껍질: 짙은 청록·갈색 (익기 전 아스타잔틴 단백질 색)
    l = arr(lo); lum = l.mean(-1, keepdims=True)
    raw = lum * np.array([0.42, 0.5, 0.55]) + 6
    save_jpg(img(raw), 'lobster_shell_raw', 380)
    save_jpg(Image.open(f'{SRC}/orig-lobster-16.jpg').convert('RGB').crop((720, 140, 1500, 470)), 'lobster_meat', 520)

# ── 가니쉬 ──
if job('garnish'):
    t = Image.open(f'{SRC}/orig-tomato-0.jpg').convert('RGB').crop((1010, 345, 1390, 690))
    a = arr(t)
    al = ellipse_alpha(t.width, t.height, 190, 168, 170, 150, 0.03)
    trim_save(img(np.dstack([a, al * 255])).convert('RGBA'), 'tomato_half', 200)
    asp = Image.open(f'{SRC}/orig-asparagus-6.jpg').convert('RGB').rotate(-12.5, resample=Image.BICUBIC, center=(480, 560))
    asp = asp.crop((0, 350, 840, 540)).rotate(-4.6, resample=Image.BICUBIC, center=(420, 95)).crop((10, 46, 830, 152))
    save_jpg(asp, 'asparagus_strip', 520)

# ── 가니쉬 2: 구운 마늘·양송이·로즈마리 ──
if job('garnish2'):
    # 통마늘 한 쪽 (껍질 벗긴 것) → 오븐에 구운 황금빛
    a = arr(cutout(Image.open(f'{SRC}/orig-garlic-0.jpg').crop((430, 840, 930, 1160))))
    lum = a[..., :3].mean(-1, keepdims=True) / 255
    m = lum[a[..., 3] > 128].mean()
    roast = np.array([238, 172, 80], np.float32) * np.clip(0.95 + (lum - m) * 2.6, 0.3, 1.3)
    edge = 1 - np.asarray(img(a[..., 3]).filter(ImageFilter.MinFilter(15)).filter(ImageFilter.GaussianBlur(8)), np.float32)[..., None] / 255
    a[..., :3] = roast * (1 - 0.45 * edge) + np.array([120, 60, 20]) * 0.45 * edge
    trim_save(img(a).convert('RGBA'), 'garlic_roast', 200)
    # 생마늘 쪽 (프렙 화면 등)
    trim_save(cutout(Image.open(f'{SRC}/orig-garlic-0.jpg').crop((430, 840, 930, 1160))).convert('RGBA'), 'garlic_clove', 200)
    # 양송이 슬라이스: 흰 도마 위라 isnet 모델 사용, 겹친 조각은 직선으로 잘라냄
    from rembg import remove, new_session
    m = remove(Image.open(f'{SRC}/orig-mushroom-7.jpg').convert('RGB').resize((960, 640)), session=new_session('isnet-general-use'))
    a = arr(m.crop((218, 384, 510, 552)))
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    cut = ((xx > 140) & (yy < (xx - 150) * 55 / 142 + 8)) | (xx > 272)
    a[..., 3] *= ~cut
    # 버터에 구운 갈색 (갓 가장자리는 진하게)
    lum = a[..., :3].mean(-1, keepdims=True) / 255
    a[..., :3] = a[..., :3] * np.array([0.92, 0.78, 0.6]) * (0.85 + 0.2 * lum)
    trim_save(soften_alpha(img(a).convert('RGBA'), 0.8), 'mushroom_slice', 220)
    trim_save(cutout(Image.open(f'{SRC}/orig-rosemary-5.jpg')).convert('RGBA').rotate(-90, expand=True), 'rosemary', 360)

# ── 가니쉬 3: 레몬 웨지·파슬리·바게트 속살 ──
if job('garnish3'):
    a = arr(cutout(Image.open(f'{SRC}/orig-lemon-4.jpg').crop((175, 25, 495, 305))))
    a[..., :3] = np.clip(a[..., :3] * np.array([1.18, 1.12, 0.9]) + 10, 0, 255)
    trim_save(soften_alpha(img(a).convert('RGBA'), 0.6), 'lemon_wedge', 220)
    def greens(im):
        a = arr(im.convert('RGBA')); r, g, b = a[..., 0], a[..., 1], a[..., 2]
        a[..., 3] *= np.clip((g - np.maximum(r, b) * 1.08) / 18, 0, 1)  # 초록 잎만 (나무 바닥·실·흰 번짐 제거)
        return img(a).convert('RGBA')
    trim_save(greens(cutout(Image.open(f'{SRC}/orig-parsley-1.jpg').crop((1320, 350, 1910, 930)))), 'parsley_sprig', 260)
    # 잘게 다진 파슬리 조각용: 잎 한 장
    trim_save(greens(cutout(Image.open(f'{SRC}/orig-parsley-1.jpg').crop((800, 1150, 1060, 1420)))), 'parsley_leaf', 90)
    save_jpg(Image.open(f'{SRC}/orig-baguette-2.jpg').convert('RGB').crop((590, 650, 1140, 990)), 'baguette_crumb', 320)

# ── 새우 한 마리 (구운 새우, 흰 접시 위) → 익은/생 스프라이트 ──
if job('shrimp'):
    a = arr(cutout(Image.open(f'{SRC}/orig-shrimpov2-11.jpg').crop((45, 430, 535, 683))))
    h = a.shape[0]
    a[..., 3] *= np.clip((h - 4 - np.arange(h)[:, None]) / 14, 0, 1)  # 잘린 아랫단은 부드럽게
    trim_save(soften_alpha(img(a).convert('RGBA'), 0.7), 'shrimp_cooked', 260)
    # 생새우: 회청색 반투명, 그릴 자국은 옅게
    lum = a[..., :3].mean(-1, keepdims=True)
    lum = np.maximum(lum, 70 + lum * 0.5)
    a[..., :3] = lum * np.array([0.8, 0.86, 0.92]) + 10
    trim_save(soften_alpha(img(a).convert('RGBA'), 0.7), 'shrimp_rawsprite', 260)

# ── 생새우 통마리 (손질 화면): 등 내장선 좌표도 함께 출력 ──
if job('shrimpwhole'):
    box = (25, 60, 850, 650)
    c = arr(cutout(Image.open(f'{SRC}/orig-sov5-8.jpg').crop(box)))
    # 바닥의 흰 밀가루 자국 제거: 채도 낮은 부분을 걷어냄 (새우 몸은 갈색·분홍)
    from scipy import ndimage as nd
    keep = (sat_mask(c, 0.1, 0.18) > 0.5) & (c[..., 3] > 128)
    keep = nd.binary_opening(keep, iterations=2)
    lab, n = nd.label(keep)
    if n: keep = lab == (np.argmax(nd.sum(keep, lab, range(1, n + 1))) + 1)  # 가장 큰 덩어리(새우)만
    keep = nd.binary_fill_holes(nd.binary_closing(keep, iterations=4))       # 몸통 하이라이트 구멍 메움
    m = img(keep * 255.0).filter(ImageFilter.GaussianBlur(1.2))
    c[..., 3] = np.minimum(c[..., 3], arr(m))
    c[..., :3] = np.clip((c[..., :3] - 60) * 1.25 + 72, 0, 255)  # 흐린 조명 보정
    c = img(c).convert('RGBA')
    bb = c.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    c = c.crop(bb)
    W = 300
    c = c.resize((W, round(c.height * W / c.width)), Image.LANCZOS)
    c.save(f'{OUT}/shrimp_whole.webp', quality=88, method=6)
    back = [(330, 140), (420, 122), (520, 114), (600, 113), (668, 125), (722, 154), (762, 196), (788, 248), (798, 302), (795, 358), (782, 412), (766, 444)]
    sx = W / (bb[2] - bb[0])
    norm = [((x - box[0] - bb[0]) * sx / W, (y - box[1] - bb[1]) * sx / W) for x, y in back]
    print('shrimp_whole', c.size, 'aspect', round(c.height / c.width, 4))
    print('vein', [(round(u, 3), round(v, 3)) for u, v in norm])

# ── 랍스터 꼬리 껍질 (위에서 본 생 꼬리) → 생/익은(주홍) 두 장 ──
if job('lobstertail'):
    t = Image.open(f'{SRC}/orig-lobov-6.jpg').convert('RGB').crop((322, 50, 662, 700)).resize((240, 459), Image.LANCZOS)
    save_jpg(t, 'lobster_tail_raw', 240)
    # 익으면 아스타잔틴이 풀려 주홍색: 색상만 주홍으로 돌리고 밝은 반점은 크림색 유지
    hsv = np.asarray(t.convert('HSV'), np.float32)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    spot = np.clip((v - 200) / 40, 0, 1) * np.clip((120 - s) / 60, 0, 1)
    h = np.full_like(h, 11) + (h - h.mean()) * 0.06
    s = np.clip(s * 1.05 + 40, 0, 228) * (1 - spot * 0.7)
    v = np.clip(v * 1.04 + 8, 0, 255)
    cooked = Image.merge('HSV', [img(c) for c in (h % 256, s, v)]).convert('RGB')
    save_jpg(cooked, 'lobster_tail_cooked', 240)

# ── 테르미도르 치즈 그라탱 표면: 허브 잎이 없는 조각만 골라 이어 붙임 ──
if job('gratin'):
    a = arr(Image.open(f'{SRC}/orig-gratin-0.jpg').convert('RGB').crop((75, 205, 715, 830)))
    rgb = a / 255
    green = (rgb[..., 1] > rgb[..., 0] * 0.95) & (rgb[..., 1] > rgb[..., 2] * 1.15)
    gm = np.asarray(img(green * 255.0).filter(ImageFilter.MaxFilter(11)), np.float32) / 255
    rng = np.random.default_rng(3)
    W = H = 320; P = 96; step = P // 2
    win1 = np.sin(np.linspace(0, np.pi, P)) ** 2
    win = (win1[:, None] * win1[None, :])[..., None] + 1e-4
    acc = np.zeros((H, W, 3), np.float32); ws = np.zeros((H, W, 1), np.float32)
    for y in range(-step, H, step):
        for x in range(-step, W, step):
            for _ in range(400):
                sy, sx = rng.integers(0, a.shape[0] - P), rng.integers(0, a.shape[1] - P)
                if gm[sy:sy + P, sx:sx + P].mean() < 0.01: break
            patch = a[sy:sy + P, sx:sx + P]
            y0, x0, y1, x1 = max(0, y), max(0, x), min(H, y + P), min(W, x + P)
            acc[y0:y1, x0:x1] += patch[y0 - y:y1 - y, x0 - x:x1 - x] * win[y0 - y:y1 - y, x0 - x:x1 - x]
            ws[y0:y1, x0:x1] += win[y0 - y:y1 - y, x0 - x:x1 - x]
    save_jpg(img(acc / ws), 'gratin', 320)

# ── 손질대 재료: 양배추 단면·샬롯·관찰레·바게트 껍질 ──
if job('prep'):
    # 적양배추 세로 단면 → 일반 양배추 색(보라 잎맥 → 연두, 흰 심은 크림색)
    c = Image.open(f'{SRC}/orig-cabc-0.jpg').convert('RGB')
    w, h = c.size
    c = c.crop((int(w * 0.03), int(h * 0.02), int(w * 0.97), int(h * 0.99)))
    a = arr(c); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255
    purple = np.clip(((r + b) / 2 - g) / 90, 0, 1)
    pale = np.array([246, 248, 218], np.float32); leaf = np.array([196, 222, 140], np.float32)
    col = pale * lum[..., None] ** 0.5
    col = col * (1 - purple[..., None]) + (leaf * (0.62 + 0.5 * lum[..., None])) * purple[..., None]
    out = np.dstack([col, ellipse_alpha(a.shape[1], a.shape[0], a.shape[1] / 2, a.shape[0] * 0.53, a.shape[1] * 0.5, a.shape[0] * 0.52, 0.02) * 255])
    trim_save(img(out).convert('RGBA'), 'cabbage_half', 420)
    sh = cutout(Image.open(f'{SRC}/orig-shallot-0.jpg').crop((215, 525, 520, 880)))
    trim_save(sh.convert('RGBA').rotate(-28, expand=True, resample=Image.BICUBIC), 'shallot', 160)
    # 관찰레 단면(지방-살코기-지방 층)을 수평으로 돌려 자름
    save_jpg(Image.open(f'{SRC}/orig-guan-8.jpg').convert('RGB').rotate(-26, resample=Image.BICUBIC, center=(330, 340)).crop((60, 296, 630, 392)), 'guanciale', 420)
    # 바게트 한 줄 (배경 제거)
    bg = Image.open(f'{SRC}/orig-bag2-11.jpg').convert('RGB').rotate(-26, resample=Image.BICUBIC, center=(600, 390)).crop((140, 255, 1024, 485))
    trim_save(cutout(bg).convert('RGBA'), 'baguette_loaf', 520)
    # 레몬 반쪽 단면 (원형), 통 방울토마토, 양송이 갓 윗면
    lm = arr(Image.open(f'{SRC}/orig-lemon-0.jpg').convert('RGB').crop((482, 282, 846, 642)))
    trim_save(img(np.dstack([lm, ellipse_alpha(364, 360, 182, 180, 181, 178, 0.015) * 255])).convert('RGBA'), 'lemon_half', 200)
    tw = arr(Image.open(f'{SRC}/orig-tomato-0.jpg').convert('RGB').crop((686, 680, 1004, 978)))
    trim_save(img(np.dstack([tw, ellipse_alpha(318, 298, 158, 150, 156, 146, 0.03) * 255])).convert('RGBA'), 'tomato_whole', 160)
    from rembg import remove, new_session
    m = remove(Image.open(f'{SRC}/orig-mushroom-7.jpg').convert('RGB').resize((960, 640)), session=new_session('isnet-general-use'))
    # 양송이 갓 표면 질감 (위에서 본 갓에 입힘)
    save_jpg(m.convert('RGB').crop((430, 42, 570, 86)).resize((220, 140), Image.LANCZOS), 'mushroom_skin', 220)
