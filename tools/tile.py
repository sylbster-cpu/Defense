# usage: tile.py out.png cols img1 img2 ...  — crops the battlefield box from 700x318(@2) shots and tiles them
import sys
from PIL import Image
out,cols=sys.argv[1],int(sys.argv[2]);files=sys.argv[3:]
ims=[]
for f in files:
    im=Image.open(f).convert('RGB');w,h=im.size
    if abs(w/h-700/318)<.02:
        k=w/700;im=im.crop((int(100*k),int(6*k),int(573*k),int(312*k)))
    elif abs(w/h-390/844)<.02:
        k=w/390;im=im.crop((int(4*k),int(4*k),int(386*k),int(566*k)))
    ims.append(im)
w=max(i.size[0] for i in ims);h=max(i.size[1] for i in ims);rows=(len(ims)+cols-1)//cols
sheet=Image.new('RGB',(w*cols,h*rows),(40,40,40))
for n,i in enumerate(ims):sheet.paste(i,((n%cols)*w,(n//cols)*h))
if sheet.size[0]>1900:
    k=1900/sheet.size[0];sheet=sheet.resize((1900,int(sheet.size[1]*k)),Image.LANCZOS)
sheet.save(out)
