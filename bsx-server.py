#!/usr/bin/env python

import sys
import redis
#import meinheld

if __name__ == '__main__':
    db = redis.Redis()

    try:
        db.ping()
    except redis.RedisError:
        print("No Redis server is running, exiting")
        sys.exit(1)

    from bsxcube import server, socketio

    socketio.run(server, host='0.0.0.0', port=8081)
    #meinheld.listen(("0.0.0.0", 8081))
    #meinheld.run(server)
