import http from 'http';
import { Socket } from 'net';

interface CallbackServerOptions {
  port: number;
  hostname: string;
}

// CallbackServer is a simple HTTP server which is used to receive the OAuth
// redirect from the OAuth provider after the user signs-in. It will shutdown
// once the callback is received and the callback promise will resolve with
// the URL of the incoming request.
export class CallbackServer {
  private server: http.Server;
  private sockets: Set<Socket>;
  private port: number;
  private hostname: string;

  public callback: Promise<string> | undefined;

  constructor(options: CallbackServerOptions) {
    this.server = http.createServer();
    this.sockets = new Set<Socket>();
    this.port = options.port;
    this.hostname = options.hostname;
  }

  async start(): Promise<string> {
    await new Promise<void>((resolve) => {
      this.server.listen(this.port, this.hostname, resolve);
    });

    // Keep track of connections so we can force a shutdown
    this.server.on('connection', (socket) => {
      this.sockets.add(socket);
      socket.on('close', () => {
        this.sockets.delete(socket);
      });
    });

    // The callback will resolve with the incoming request object
    this.callback = new Promise<string>((resolve) => {
      this.server.on('request', ({ url }, res) => {
        res.writeHead(200);
        res.end(AUTH_SUCCESS_HTML);

        // Shutdown the server and resolve the callback promise
        // with the request object
        this.shutdown().then(() => resolve(url!));
      });
    });

    // Calculate and return the URL which can be used to reach the server
    return this.serverURL(this.server);
  }

  public async shutdown(): Promise<void> {
    // Destroy all sockets and close the server
    return new Promise<void>((resolve) => {
      for (const socket of this.sockets) {
        socket.destroy();
        this.sockets.delete(socket);
      }
      this.server.close(() => resolve());
    });
  }

  private serverURL(server: http.Server): string {
    const address = server.address();
    /* istanbul ignore next */
    if (address === null) {
      throw new Error('invalid server config: address is null');
    } else if (typeof address === 'string') {
      throw new Error('invalid server config: address is a string');
    }

    return `http://${this.hostname}:${address.port}`;
  }
}

// This HTML is copied from the Go Sigstore library and was originally authored by Julien Vermette:
// https://github.com/sigstore/sigstore/blob/main/pkg/oauth/interactive.go
const AUTH_SUCCESS_HTML = `
<html>
  <head>
    <title>Sigstore Authentication</title>
    <link id="favicon" rel="icon" type="image/svg"/>
    <style>
      :root { font-family: "Trebuchet MS", sans-serif; height: 100%; color: #444444; overflow: hidden; }
      body { display: flex; justify-content: center; height: 100%; margin: 0 10%; background: #FFEAD7; }
      .container { display: flex; flex-direction: column; justify-content: space-between; }
      .sigstore { color: #2F2E71; font-weight: bold; }
      .header { position: absolute; top: 30px; left: 22px; }
      .title { font-size: 3.5em; margin-bottom: 30px; animation: 750ms ease-in-out 0s 1 show; }
      .content { font-size: 1.5em; animation: 250ms hide, 750ms ease-in-out 250ms 1 show; }
      .anchor { position: relative; }
      .links { display: flex; justify-content: space-between; font-size: 1.2em; padding: 60px 0; position: absolute; bottom: 0; left: 0; right: 0; animation: 500ms hide, 750ms ease-in-out 500ms 1 show; }
      .link { color: #444444; text-decoration: none; user-select: none; }
      .link:hover { color: #6349FF; }
      .link:hover>.arrow { transform: scaleX(1.5) translateX(3px); }
      .link:hover>.sigstore { color: inherit; }
      .link, .arrow { transition: 200ms; }
      .arrow { display: inline-block; margin-left: 6px; transform: scaleX(1.5); }
      @keyframes hide { 0%, 100% { opacity: 0; } }
      @keyframes show { 0% { opacity: 0; transform: translateY(40px); } 100% { opacity: 1; } }
    </style>
  </head>
  <body>
    <div class="container">
      <div>
        <a class="header" href="https://sigstore.dev">
          <svg id="logo" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="28.14" height="30.3">
            <circle r="7" cx="14" cy="15" fill="#FFEAD7"></circle>
            <path fill="#2F2E71" d="M27.8 10.9c-.3-1.2-.9-2.2-1.7-3.1-.6-.7-1.3-1.3-2-2-.7-.6-1.2-1.3-1.5-2.1-.2-.4-.4-.8-.7-1.2-.5-.7-1.3-1.2-2.1-1.6-1.3-.7-2.7-.9-4.2-.9-.8 0-1.6.1-2.4.3-1.2.2-2.3.7-3.4 1.3-.7.4-1.3.9-1.9 1.4-1 .8-2 1.6-2.8 2.6-.6.8-1.4 1.3-2.2 1.8-.8.4-1.4 1-2 1.6-.6.6-.9 1.3-.9 2.1 0 .6.1 1.2.2 1.7.2.9.6 1.7.9 2.6.2.5.3 1 .3 1.5s0 1-.1 1.5c-.1 1.1 0 2.3.2 3.4.2 1 .8 1.8 1.8 2.2.1.1.3.1.4.1.2.1.2.2.1.3l-.1.1c-.4.5-.7 1.1-.6 1.8.1 1.1 1.3 1.8 2.3 1.3.6-.2 1.2 0 1.4.4.1.1.1.2.2.3.2.5.4.9.7 1.3.4.5.9.7 1.6.6.4-.1.8-.2 1.2-.4.7-.4 1.3-.9 2-1.5.2-.2.4-.2.7-.2.4 0 .8.2 1.2.5.6.4 1.2.7 1.9.9 1.3.4 2.5.5 3.8.2 1.3-.3 2.4-.9 3.4-1.6.7-.5 1.2-1 1.6-1.7.4-.7.6-1.4.8-2.2.3-1.1.4-2.2.4-3.4.1-1 .2-1.9.5-2.8.2-.7.5-1.4.8-2.1.2-.6.4-1.2.5-1.9.1-1.1 0-2.1-.3-3.1zM14.9.8c.3-.1.7-.1 1-.1h.3c1.1 0 2.1.2 3.1.5.6.2 1.2.6 1.7 1s.7.9.9 1.4v.1c0 .1 0 .2-.1.2s-.1 0-.2-.1c-.4-.4-.7-.8-1.1-1.1-.6-.5-1.2-.9-2-1.1-1.1-.3-2.1-.5-3.2-.7h-.6c.1 0 .1 0 .2-.1-.1 0 0 0 0 0zm-4.5 12.4c.6 0 1.1.5 1.2 1.2 0 .6-.5 1.2-1.2 1.2-.6 0-1.2-.5-1.1-1.2 0-.7.5-1.2 1.1-1.2zm3.8 1.3v-3.4c0-2.3 2-3.1 3.6-2.5.3.1.6.3.9.5.2.2.2.5.1.8-.2.2-.4.3-.7.1-.2-.1-.5-.2-.7-.3-.6-.2-1.3 0-1.6.4-.1.2-.2.4-.2.7-.1.5 0 .9 0 1.4v5.9c0 1.2-.6 2.1-1.8 2.4-1 .3-1.9.2-2.7-.6-.2-.2-.3-.5-.1-.7.1-.2.4-.3.7-.2.3.1.6.3.9.4 1 .1 1.7-.3 1.7-1.4-.1-1.2-.1-2.3-.1-3.5zm-8.8 7.6h-.1c-.1-.1-.2-.1-.3-.2-.2-.2-.4-.3-.6-.5-.3-.3-.5-.6-.7-1-.4-.8-.8-1.7-1-2.7-.1-.5-.2-1-.2-1.5s-.1-1-.2-1.4c-.1-.7-.2-1.5-.2-2.2 0-.9.1-1.7.4-2.5.3-.9.7-1.7 1.4-2.4.6-.6 1.1-1.2 1.7-1.8.1-.1.3-.2.4-.2 0 .1-.1.3-.2.4-.3.4-.6.7-.9 1.1-.5.6-.9 1.2-1.2 1.8-.4.7-.7 1.4-.9 2.2-.1.4-.2.8-.2 1.2 0 .4-.1.8 0 1.3 0 .6.1 1.1.2 1.6.1.6.2 1.1.2 1.7 0 .7.2 1.4.4 2.1 0 .2.2.3.2.5.3.6.6 1.1 1.1 1.5.2.2.4.5.6.7 0 0 0 .1.1.1v.2zM8 24.6c-.4 0-.7.1-1.1.2-.4.1-.6-.1-.7-.5 0-.1-.1-.3 0-.4.1-.3.3-.3.5-.1.2.2.5.4.7.5.1.1.2.1.4.1.1 0 .2.1.4.2H8zm7.6 2.1c-.3.2-.7.3-1.1.3-.3 0-.6-.1-.9-.1h-.2c-.4.1-.7.1-1.1.2-.1 0-.3 0-.4.1H11c-.4 0-.7-.2-1-.5-.1-.1-.2-.3-.3-.5-.1-.1-.1-.2-.1-.4 0-.1.1-.1.2-.1h.1c.5.3 1.1.4 1.6.5.7.1 1.4.2 2.1.2.4 0 .7.1 1.1.1h.8c.2.1.1.1.1.2zm3.7-2.5c-.7.4-1.5.7-2.3.9-.2 0-.5.1-.7.1-.2 0-.5 0-.7.1-.4.1-.8 0-1.2 0-.3 0-.6-.1-.9 0h-.2c-.4-.1-.9-.2-1.3-.3-.5-.1-1-.3-1.4-.5-.4-.1-.8-.3-1.1-.5-.2-.1-.4-.3-.6-.4-.6-.6-1.2-1.1-1.7-1.6-.4-.5-.8-.9-1.2-1.4-.4-.6-.7-1.2-1-1.9l-.3-.9c-.1-.3-.2-.5-.2-.8v-.8c.3.8.5 1.7.9 2.5.7 1.6 1.7 3 3 4.1 1.4 1.1 2.9 1.8 4.6 2.1.9.2 1.8.2 2.7.2 1.1-.1 2.2-.3 3.2-.8.2-.1.3-.2.5-.2 0 .1 0 .1-.1.1zm.1-8.7c-.6 0-1.1-.5-1.1-1.2 0-.6.5-1.2 1.2-1.2.6 0 1.1.5 1.1 1.2s-.5 1.3-1.2 1.2zm6.2 5.7c0 .4-.1.8-.2 1.2-.1.4-.1.9-.3 1.3-.1.4-.2.7-.4 1.1-.1.3-.3.6-.6.8-.3.2-.5.4-.9.5-.4.2-.7.3-1.2.3h-.9c-.2-.1-.2-.1-.1-.3.1-.2.3-.3.5-.4.3-.2.6-.5.8-.7.7-.7 1.3-1.6 1.9-2.4.4-.4.6-1 .9-1.5.1-.1.1-.2.2-.3.3.2.3.3.3.4zm-15-16.8c1.7-.8 3.5-1.1 5.3-.9.4 0 .8.1 1.1.3l1.8.6c.6.2 1.2.5 1.7.8.7.4 1.3.9 1.9 1.5.8.8 1.5 1.6 2 2.6.3.6.5 1.2.7 1.8.2.7.4 1.5.4 2.2v.9c0 .4-.1.8-.1 1.2v-1c0-1.2-.3-2.3-.6-3.4l-.6-1.5c-.2-.6-.5-1.1-.9-1.6-.1-.1-.3-.1-.4-.2-.1 0-.1 0-.2-.1-.5-.5-1.1-1-1.7-1.5-.8-.6-1.7-1.1-2.6-1.4-.4-.2-.8-.3-1.2-.4-.9-.2-1.8-.4-2.7-.3h-.9c-.3 0-.6.1-1 .2-.6.1-1.2.3-1.7.5h-.1s-.1 0 0-.1c0 0 0-.1-.1-.2m16.2 11.1c-.1-.8 0-1.7 0-2.5-.1-.8-.2-1.6-.4-2.4.5.7.6 1.6.7 2.4 0 .8 0 1.7-.3 2.5zm.6.5c0-.3.1-.7.2-1.1.1-.4.1-.9.1-1.3v-.4c0-.8-.2-1.6-.4-2.4-.4-.9-.8-1.6-1.4-2.4-.5-.6-.9-1.2-1.4-1.8l-.2-.2c.1 0 .1 0 .1.1 1 .8 1.8 1.6 2.4 2.7.5 1 .9 2 1 3.1.3 1.3.1 2.5-.4 3.7z"/>
          </svg><svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="120" height="30.3" viewBox="28.14 0 120 30.3">
            <path fill="#2F2E71" d="M57.7 18c.9 0 1.9-.1 2.9.3.9.3 1.5.9 1.7 2 .1 1-.2 1.9-1.1 2.5-1.1.8-2.3.9-3.6 1-1.4 0-2.9 0-4.3-.6-1.6-.7-1.8-2.6-.4-3.6.3-.2.2-.3.1-.5-.7-.8-.7-2.2.3-2.8.3-.2.2-.3 0-.6-1.4-1.6-.7-4.1 1.3-4.8 1.6-.6 3.2-.6 4.8-.1.2.1.3.1.5-.1.3-.3.6-.5.9-.7.5-.3 1.1-.3 1.4 0 .3.4.3.9-.2 1.3-.7.5-.8 1-.6 1.9.4 1.5-.6 2.9-2.1 3.4-1.3.5-2.7.5-4 .2-.3-.1-.5-.1-.6.2-.1.3-.1.6.2.8.2.1.5.2.8.2h2zm-.6-2.7c.3 0 .5 0 .7-.1.8-.2 1.3-.7 1.4-1.4.1-.7-.3-1.3-.9-1.6-.8-.3-1.6-.3-2.4 0-1 .4-1.2 1.7-.6 2.4.5.6 1.2.7 1.8.7zm-.2 4.6h-1.8c-.4 0-.6.2-.7.5-.3.7.1 1.2.9 1.4 1.2.2 2.5.2 3.7-.1l.6-.3c.5-.3.4-1.1-.1-1.3-.2-.1-.5-.2-.7-.2h-1.9zm58.6-3.3h-3.2c-.3 0-.3.1-.3.4.2 1.2 1.3 2.1 2.8 2.3 1.1.1 2.1-.1 2.9-.9.2-.2.4-.3.6-.4.4-.2.8-.2 1.1.1.4.3.4.7.3 1.1-.3.9-.9 1.4-1.7 1.8-2.3 1-4.5.9-6.5-.6-1-.7-1.5-1.8-1.7-3-.3-1.7-.2-3.3.8-4.7 1.3-1.8 3.1-2.4 5.2-2.1 2 .3 3.4 1.3 4 3.2.2.6.3 1.2.2 1.8-.1.8-.4 1.1-1.2 1.1-1.1-.1-2.2-.1-3.3-.1zm-.7-1.9h2.4c.4 0 .4-.1.4-.5-.3-1.1-1.2-1.9-2.5-2-1.5-.1-2.6.6-3.1 1.9-.2.5-.1.6.4.6h2.4zm-23 6.7c-3.3 0-5.5-2.2-5.6-5.5 0-3.2 2.2-5.6 5.4-5.6 3.4 0 5.7 2.2 5.8 5.5 0 3.4-2.2 5.6-5.6 5.6zm0-2.1c1.9 0 3.2-1.3 3.3-3.3.1-2-1.3-3.4-3.2-3.4-1.8 0-3.2 1.4-3.2 3.3-.1 1.9 1.2 3.4 3.1 3.4zm-22.6 2.1c-1.1 0-2.4-.3-3.5-1.4-.3-.4-.6-.8-.7-1.3 0-.4.1-.7.4-.9.3-.2.7-.2 1 0 .3.2.6.4.8.6.9.9 2 1.1 3.2.9.6-.1 1-.5 1-1 .1-.5-.2-1-.8-1.2-.7-.3-1.4-.3-2.1-.5-.8-.2-1.6-.4-2.2-.9-1.5-1.2-1.4-3.5.2-4.6 1.2-.8 2.6-.9 4-.7 1 .1 1.9.5 2.6 1.2.3.3.4.6.5.9.1.4 0 .7-.3 1-.3.3-.7.3-1 .1-.4-.2-.7-.5-1.1-.8-.8-.6-1.7-.8-2.7-.5-.6.1-.9.5-.9 1s.3.9.8 1.1c.9.3 1.9.4 2.9.7.6.2 1.1.4 1.5.8 1.5 1.4 1.1 4.1-.9 5.1-.7.3-1.5.4-2.7.4zm-30.3 0c-1.5 0-3-.3-4.1-1.5-.3-.3-.4-.6-.5-1-.1-.4-.1-.8.3-1.1.4-.2.9-.2 1.3.1.3.2.6.5.8.7.9.8 1.9.9 3 .7.6-.1.9-.5.9-1.1 0-.5-.3-1-.8-1.2l-2.7-.6c-1.1-.3-2-.8-2.4-2-.6-1.7.4-3.4 2.2-3.9 1.7-.5 3.3-.3 4.8.5.6.3 1 .8 1.2 1.4.1.4.1.9-.3 1.1-.4.3-.8.2-1.2-.1-.4-.3-.7-.7-1.2-.9-.8-.4-1.5-.5-2.4-.3-.5.1-.8.4-.8.9s.2.8.7 1c.7.3 1.4.3 2.1.5.8.2 1.5.3 2.2.8 1.2.8 1.5 2.5.9 3.8-.7 1.4-1.9 1.8-3.3 2-.3.2-.5.2-.7.2zM78 15.8v-2.6c0-.3-.1-.4-.4-.4h-1.3c-.6-.1-.9-.5-.9-1s.4-1 .9-1h1.3c.3 0 .4-.1.4-.4V8.9c0-.7.5-1.1 1.1-1.2.6 0 1.1.4 1.2 1v.6c0 .4-.2 1 .1 1.3.3.3.9.1 1.3.1h1.6c.4 0 .7.3.8.8.1.4-.1.8-.4 1.1-.3.2-.6.2-.9.2h-2.1c-.3 0-.4 0-.4.4v4.7c0 1.1.9 1.6 1.9 1.1.3-.1.5-.3.7-.5.4-.3.8-.3 1.2 0 .4.3.4.8.2 1.2-.3.7-.9 1.1-1.5 1.3-1.3.5-2.6.5-3.8-.4-.7-.6-1-1.4-1.1-2.4.1-.7.1-1.6.1-2.4zm24.7-4.1c.8-1 1.8-1.4 3-1.3.7.1 1.4.3 1.9.9.3.4.5.9.4 1.5-.1.4-.3.7-.7.9-.5.2-.9 0-1.3-.3-.7-.7-1.3-.9-2.1-.5-.5.3-.8.7-1 1.3-.2.5-.3 1.1-.3 1.6v4.5c0 .5-.2.9-.6 1.1-.4.2-.8.2-1.2-.1-.4-.3-.5-.7-.5-1.1v-8.4c0-.7.4-1.2 1-1.3.7-.1 1.1.3 1.3 1.1.1-.1.1 0 .1.1zm-54 4.2v4.3c0 .8-.6 1.3-1.4 1.2-.5-.1-.9-.5-.9-1.1v-8.7c0-.7.5-1.1 1.2-1.1s1.1.4 1.2 1.2c-.1 1.3-.1 2.8-.1 4.2zm.3-8.2c0 .8-.6 1.4-1.4 1.4-.8 0-1.5-.6-1.5-1.4 0-.8.7-1.4 1.5-1.4s1.4.6 1.4 1.4z"/>
          </svg>
        </a>
      </div>
      <div>
        <div class="title">
          <span class="sigstore">sigstore </span>
          <span>authentication successful!</span>
        </div>
        <div class="content">
          <span>You may now close this page.</span>
        </div>
      </div>
      <div class="anchor">
        <div class="links">
          <a href="https://sigstore.dev/" class="link login"><span class="sigstore">sigstore</span> home <span class="arrow">&rarr;</span></a>
          <a href="https://docs.sigstore.dev/" class="link login"><span class="sigstore">sigstore</span> documentation <span class="arrow">&rarr;</span></a>
          <a href="https://blog.sigstore.dev/" class="link"><span class="sigstore">sigstore</span> blog <span class="arrow">&rarr;</span></a>
        </div>
      </div>
    </div>
    <script>
      document.getElementById("favicon").setAttribute("href", "data:image/svg+xml," + encodeURIComponent(document.getElementById("logo").outerHTML));
    </script>
  </body>
</html>
`;
