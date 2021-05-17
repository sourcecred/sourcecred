"""Serve SourceCred API, for consumption by Observable notebooks.

Usage:

    python3 ./scripts/serve_api.py [PORT]

from the SourceCred repository root. Omit the port to try a default, or
specify port 0 to pick a free port automatically.

This server binds to `localhost`, which is a loopback address only
accessible from your machine, not the local network.

Corresponding Observable code:

    sourcecred = {
      const server = "http://localhost:9009";
      const blob = await fetch(server).then((r) => r.blob());
      const esModule = await require(URL.createObjectURL(blob));
      return esModule.default;
    }

    myGraph = new sourcecred.core.graph.Graph()  // e.g.

This server serves the same response for all requests.

For best results, run concurrently with `yarn api --watch`. After
changing SourceCred code, just re-execute the definition of the
`sourcecred` module in the Observable notebook to live-load the new code
and update your notebook.
"""

from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import os
import sys
from wsgiref import simple_server


_API_FILE = os.path.join("dist", "api.js")
_DEFAULT_PORT = 9009


def _app(environ, start_response):
    # This will 500 if the file can't be read, which is fine.
    with open(_API_FILE, "rb") as infile:
        # Re-read the file every time to account for updates.
        contents = infile.read()
    headers = [
        ("Access-Control-Allow-Origin", "*"),
        ("Content-Type", "application/javascript; charset=UTF-8"),
        ("X-Content-Type-Options", "nosniff"),
    ]
    start_response("200 OK", headers)
    return (contents,)


def _main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else _DEFAULT_PORT
    server = simple_server.make_server("localhost", port, _app)
    print("Serving on port %d" % server.server_port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print()
        pass


if __name__ == "__main__":
    _main()
