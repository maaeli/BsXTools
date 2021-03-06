#from __future__ import absolute_import

from gevent import monkey
monkey.patch_all(thread=True)

#import mock
import os
import logging
import sys
import time
import traceback


import gevent

from optparse import OptionParser

from flask import Flask, request
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_session import Session


# To make "from HardwareRepository import ..." possible
fname = os.path.dirname(__file__)
sys.path.insert(0, fname)

#from HardwareRepository import HardwareRepository as hwr
#hwr.addHardwareObjectsDirs([os.path.join(fname, 'HardwareObjects')])

import app as bsxcube

#sys.modules["Qub"] = mock.Mock()
#sys.modules["Qub.CTools"] = mock.Mock()

XML_DIR = os.path.join(os.path.join(os.path.dirname(__file__), os.pardir),
                       "test/HardwareObjectsMockup.xml/")

opt_parser = OptionParser()

# opt_parser.add_option("-r", "--repository",
#                       dest="hwr_directory",
#                       help="Hardware Repository XML files path",
#                       default=XML_DIR)
#
# opt_parser.add_option("-l", "--log-file",
#                       dest="log_file",
#                       help="Hardware Repository log file name",
#                       default='')
#
# opt_parser.add_option("-v", "--video-device",
#                       dest="video_device",
#                       help="Video device, defaults to: No device",
#                       default='')
#
# opt_parser.add_option("-w", "--ra",
#                       action="store_true",
#                       dest="allow_remote",
#                       help="Enable remote access",
#                       default=False)
#
# opt_parser.add_option("-t", "--ra-timeout",
#                       action="store_true",
#                       dest="ra_timeout",
#                       help="Timeout gives control",
#                       default=False)

#cmdline_options, args = opt_parser.parse_args()

INIT_EVENT = gevent.event.Event()


def exception_handler(e):
    err_msg = "Uncaught exception while calling %s" % request.path
    logging.getLogger("exceptions").exception(err_msg)
    return err_msg + ": " + traceback.format_exc(), 409


t0 = time.time()

template_dir = os.path.join(os.path.dirname(__file__), "templates")
server = Flask(__name__,  static_url_path='', template_folder=template_dir)
CORS(server, expose_headers='Authorization')
server.config['CORS_HEADERS'] = 'Content-Type'

server.debug = False
server.config['SESSION_TYPE'] = "redis"
server.config['SESSION_KEY_PREFIX'] = "bsxcube:session:"
server.config['SECRET_KEY'] = "nosecretfornow"
server.register_error_handler(Exception, exception_handler)

_session = Session()
_session.init_app(server)

socketio = SocketIO(manage_session=False)#,  async_mode="gevent")
socketio.init_app(server)

# the following test prevents Flask from initializing twice
# (because of the Reloader)
if not server.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
    bsxcube.init()

    #from core import loginutils

    # Make the valid_login_only decorator available on server object
    #server.restrict = loginutils.valid_login_only

    # Install server-side UI state storage
    bsxcube.init_state_storage()

    # Importing REST-routes
    from routes import (view2d)#main, login, beamline, mockups, samplecentring,
    #                    samplechanger, diffractometer, queue, lims, workflow,
#                        detector, ra)

    msg = "BsXcube initialized, it took %.1f seconds" % (time.time() - t0)
    logging.getLogger("HWR").info(msg)
