"""
Cut a generated widget render out of its black backdrop and save it for the app.

  python cutout.py <render> <name>      ->  public/widgets/<name>.webp

Needs rembg (pip install "rembg[cpu]"); the ISNet model downloads on first use. The
object is trimmed to its silhouette and set in a square with an even margin, so every
widget sits at the same visual size in the carousel.
"""
import os
import sys

from PIL import Image, ImageFilter
from rembg import new_session, remove

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SIZE = 720  # px: the widget shows at up to ~340 CSS px, so this covers 2x screens.
MARGIN = 0.06

src, name = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
cut = remove(im, session=new_session("isnet-general-use"), post_process_mask=True)

# Drop faint specks the matte leaves in the backdrop, then crop to the object.
alpha = cut.getchannel("A").point(lambda a: 0 if a < 12 else a)
cut.putalpha(alpha.filter(ImageFilter.GaussianBlur(0.4)))
cut = cut.crop(cut.getbbox())

side = max(cut.size)
canvas = Image.new("RGBA", (int(side * (1 + 2 * MARGIN)),) * 2, (0, 0, 0, 0))
canvas.paste(cut, ((canvas.width - cut.width) // 2, (canvas.height - cut.height) // 2))
canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
out = os.path.join(ROOT, "public", "widgets", f"{name}.webp")
canvas.save(out, "WEBP", quality=90, method=6)
print("cut", name, "->", out)
