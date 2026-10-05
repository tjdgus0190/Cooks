# 스테이크 사진 텍스처 생성: 원본(위키미디어 공용, CC) → www/assets/food/
# 사용: python3 tools/assets/build_steak.py <원본폴더>
import sys, os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/assets'
OUT = os.path.join(os.path.dirname(__file__), '../../www/assets/food')
os.makedirs(OUT, exist_ok=True)

def quilt(src, W, H, P=150, seed=1):
    """확률적 질감(크러스트 등)을 겹치는 패치로 넓게 합성 — 부드러운 창함수로 이음매 없이 섞는다"""
    a = np.asarray(src, dtype=np.float32)
    sh, sw = a.shape[:2]
    rng = np.random.default_rng(seed)
    acc = np.zeros((H, W, 3), np.float32); wsum = np.zeros((H, W, 1), np.float32)
    win1 = np.sin(np.linspace(0, np.pi, P)) ** 2
    win = (win1[:, None] * win1[None, :])[..., None] + 1e-4
    step = P // 2
    for y in range(-step, H, step):
        for x in range(-step, W, step):
            x += int(rng.integers(-step // 2, step // 2)); y2 = y + int(rng.integers(-step // 2, step // 2))
            sy = rng.integers(0, sh - P); sx = rng.integers(0, sw - P)
            patch = a[sy:sy + P, sx:sx + P]
            if rng.random() < 0.5: patch = patch[:, ::-1]
            if rng.random() < 0.5: patch = patch[::-1, :]
            y0, x0 = max(0, y2), max(0, x); y1, x1 = min(H, y2 + P), min(W, x + P)
            if y1 <= y0 or x1 <= x0: continue
            p = patch[y0 - y2:y1 - y2, x0 - x:x1 - x]; w = win[y0 - y2:y1 - y2, x0 - x:x1 - x]
            acc[y0:y1, x0:x1] += p * w; wsum[y0:y1, x0:x1] += w
    out = acc / wsum
    # 섞이며 줄어든 대비 복원 (국소 평균 기준)
    m = np.asarray(Image.fromarray(out.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(20)), np.float32)
    out = m + (out - m) * 1.3
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))

# 1) 생 립아이 윗면: 사진 중앙(꽃등심 눈·지방 고리)
raw = Image.open(f'{SRC}/w-rawrib.jpg').convert('RGB').crop((300, 150, 940, 600))
a = np.asarray(raw, np.float32)
yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
dark = (a.sum(2) < 260) & (xx > 520) & (yy < 60)  # 우상단 검은 트레이 → 지방색으로 메움
a[dark] = [236, 214, 200]
img = Image.fromarray(a.astype(np.uint8))
# 오래된 카메라의 주황 기운 → 선홍·심홍으로 보정
r, g, b = [np.asarray(c, np.float32) for c in img.split()]
lum = 0.3 * r + 0.59 * g + 0.11 * b
red = np.clip((r - g) / 120, 0, 1)  # 살코기 비율
r2 = r * (1 - 0.1 * red); g2 = g * (1 - 0.12 * red); b2 = b * (1 + 0.02 * red) + 4 * red
img = Image.merge('RGB', [Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)) for c in (r2, g2, b2)])
img = ImageEnhance.Contrast(img).enhance(1.05)
img.resize((640, 450), Image.LANCZOS).save(f'{OUT}/steak_raw.jpg', quality=88)

# 2) 시어링 크러스트: 무쇠팬 스테이크 윗면 → 회전 보정 후 질감 합성
sear = Image.open(f'{SRC}/w-searpan.jpg').convert('RGB').rotate(23, resample=Image.BICUBIC, center=(447, 310))
crust = sear.crop((205, 205, 695, 340)).resize((735, 202), Image.LANCZOS)
q = np.asarray(quilt(crust, 620, 480, P=165, seed=7), np.float32) / 255
# 버터 거품 반사로 밝아진 톤 → 짙은 마호가니
q = np.minimum(q, 0.82 + 0.18 * q)
q = np.stack([q[..., 0] ** 1.3 * 0.9, q[..., 1] ** 1.4 * 0.84, q[..., 2] ** 1.5 * 0.76], -1)
Image.fromarray((q * 255).clip(0, 255).astype(np.uint8)).save(f'{OUT}/steak_crust.jpg', quality=88)

# 3) 단면 결 디테일(그레이, 128=중립): 하이패스 → overlay 합성용
xs = Image.open(f'{SRC}/w-delmonico.jpg').convert('RGB').crop((960, 535, 1790, 715))
L = np.asarray(xs.convert('L'), np.float32)
blur = np.asarray(xs.convert('L').filter(ImageFilter.GaussianBlur(14)), np.float32)
d = (L - blur) * 1.6 + 128
Image.fromarray(d.clip(0, 255).astype(np.uint8)).resize((900, 195), Image.LANCZOS).save(f'{OUT}/steak_grain.png', optimize=True)
print('ok', os.listdir(OUT))
