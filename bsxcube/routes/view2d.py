import gevent
import logging
from flask import (
    session,
    jsonify,
    Response,
    request,
    make_response,
    copy_current_request_context,
)
from flask_socketio import send, emit


from bsxcube import socketio
from bsxcube import bsxcube
from bsxcube import server

from PIL import Image
import numpy as np


testimage = Image.open("caman.tif")
data2D = np.array(testimage, dtype=int)


#@server.route("/bsxcube/api/v0.1/get_image", methods=['GET', 'POST'])
@socketio.on('data2d')
def give_image():
    """Provides a 1d array containing the data + width & height
    """
    print("client requested data")
    width, height = data2D.shape
    print(data2D.shape)
    print(width, height)
    data1D = data2D.reshape((width*height,))
    dl = [int(i) for i in data1D]
    emit('data2d', {'data': dl, 'width': width, 'height': height})
