
import logging
import io
import time
from flask import (
    session,
    jsonify,
    Response,
    request,
    make_response,
    copy_current_request_context,
    send_file,
    g,
)
from flask_socketio import send, emit
from flask_cors import  cross_origin


from bsxcube import socketio
from bsxcube import bsxcube
from bsxcube import server

import fabio

from PIL import Image
import numpy as np
from scipy.misc import  toimage


testImage = "water"

if testImage == "water":
    with fabio.open("water_001_00001.edf") as testimage:
        data2D = testimage.data
else:
    testimage = Image.open("caman.tif")
    data2D = np.array(testimage, dtype=int)

import matplotlib.cm as cm

cmap = cm.get_cmap('jet')

print(data2D)

#from scipy.misc import toimage
#toimage(data2D).show()

#@server.route("/bsxcube/api/v0.1/get_image", methods=['GET', 'POST'])
@socketio.on('data2d')
def give_data():
    """Provides a 1d array containing the data + width & height
    """
    print("client requested data")
    height, width = data2D.shape
    print(data2D.shape)
    print(width, height)
    data1D = data2D.reshape((width*height,))
    dl = [int(i) for i in data1D]
    #The json dump with json.dumps takes about 70 ms, with ujson.dumps 65ms...
    emit('data2d', {'data': dl, 'width': width, 'height': height})
    #emit('data2d', {'data': "", 'width': width, 'height': height})

@server.route('/', methods=['GET', 'POST'])
@server.route('/imagergb', methods=['GET', 'POST'])
@server.route('/imagergb/<int:min>/<int:max>.png', methods=['GET', 'POST'])
@server.route('/imagergb/<int:min>/<int:max>/<int:timestamp>.png', methods=['GET', 'POST'])
def give_image(min=0,max=1000, timestamp=0):
    """Provides a png
    """
    print("client requested image")
    with fabio.open("water_001_00001.edf") as testimage:
        data2D = testimage.data
    print(min,max)

    data2D[(data2D>max)] = max
    data2D[(data2D>0)*(data2D < min)] = min
    data2D = (data2D - min)/(max - min)
    im = cmap(data2D)
    img = toimage(np.uint8(im * 255))

    return serve_pil_image(img)


def serve_pil_image(pil_img):
    print("serving image")
    img_io = io.BytesIO()
    pil_img.save(img_io, 'PNG')
    img_io.seek(0)
    return send_file(img_io,  mimetype='image/png')

#This does give a number (0.22s for the image serving) but also throws errors...
# @server.before_request
# def before_request():
#     g.start = time.time()
#
# @server.after_request
# def after_request(response):
#     diff = time.time() - g.start
#     print("Request took ", diff)
