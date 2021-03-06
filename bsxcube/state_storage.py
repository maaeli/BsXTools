import json

from flask_socketio import emit, join_room, leave_room
from bsxcube import socketio
from bsxcube import app as bsxcube



def flush():
    bsxcube.UI_STATE = dict()


def init():

    @socketio.on('connect', namespace='/ui_state')
    def connect():
        pass

    @socketio.on('disconnect', namespace='/ui_state')
    def disconnect():
        pass

    @socketio.on('ui_state_get', namespace='/ui_state')
    def ui_state_get(k):
        k = k.replace("reduxPersist:", "")
        # print 'ui state GET',k,'returning:',STATE[k]
        return json.dumps(bsxcube.UI_STATE[k])

    @socketio.on('ui_state_rm', namespace='/ui_state')
    def ui_state_rm(k):
        k = k.replace("reduxPersist:", "")
        # print 'ui state REMOVE',k
        del bsxcube.UI_STATE[k]

    @socketio.on('ui_state_set', namespace='/ui_state')
    def ui_state_update(key_val):
        leave_room("raSlaves")

        key, val = key_val
        # print 'ui state SET', key
        bsxcube.UI_STATE[key.replace("reduxPersist:", "")] = json.loads(val)

        emit("state_update", json.dumps(bsxcube.UI_STATE),
             namespace="/ui_state", room="raSlaves")

    @socketio.on('ui_state_getkeys', namespace='/ui_state')
    def ui_state_getkeys(*args):
        join_room("raSlaves")

        return ['reduxPersist:'+k for k in bsxcube.UI_STATE.iterkeys()]
