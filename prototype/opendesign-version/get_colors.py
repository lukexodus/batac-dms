import sys
from collections import Counter
try:
    from PIL import Image
    import math

    def distance(c1, c2):
        return math.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2)

    for img_path in sys.argv[1:]:
        img = Image.open(img_path).convert('RGB')
        img = img.resize((150, 150))
        pixels = list(img.getdata())
        
        counts = Counter(pixels)
        
        distinct_colors = []
        for color, count in counts.most_common():
            # if too close to existing distinct colors, skip
            if any(distance(color, dc) < 40 for dc in distinct_colors):
                continue
            distinct_colors.append(color)
            if len(distinct_colors) >= 8:
                break
                
        print(f"--- {img_path} ---")
        for color in distinct_colors:
            h = "#{:02x}{:02x}{:02x}".format(color[0], color[1], color[2])
            print(f"RGB: {color}, Hex: {h}")
except Exception as e:
    print("Error:", e)
