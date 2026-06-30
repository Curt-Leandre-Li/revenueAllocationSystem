from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .app import DvasApplication


class DvasRequestHandler(BaseHTTPRequestHandler):
    app = DvasApplication()

    def do_GET(self):
        self._handle_request("GET")

    def do_POST(self):
        self._handle_request("POST")

    def do_PUT(self):
        self._handle_request("PUT")

    def do_PATCH(self):
        self._handle_request("PATCH")

    def do_DELETE(self):
        self._handle_request("DELETE")

    def do_OPTIONS(self):
        self._handle_request("OPTIONS")

    def _handle_request(self, method):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length else b""
        status, headers, body = self.app.handle_http(method, self.path, raw_body, self.headers)
        self.send_response(status)
        for key, value in headers.items():
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run(host="127.0.0.1", port=8000):
    server = ThreadingHTTPServer((host, port), DvasRequestHandler)
    print(f"DVAS local API listening on http://{host}:{port}/api/v1")
    server.serve_forever()


if __name__ == "__main__":
    run()
