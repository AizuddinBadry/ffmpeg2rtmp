const express = require("express");
const { createServer } = require("https");
const { parse } = require("url");
const next = require("next");
const socket = require("socket.io");
const WebSocketServer = require("ws").Server;
const child_process = require("child_process");
const url = require("url");
const fs = require("fs");

const port = parseInt(process.env.PORT, 10) || 8081;
const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

var options = {
  key: fs.readFileSync("./certificates/localhost.key"),
  cert: fs.readFileSync("./certificates/localhost.crt"),
};

nextApp.prepare().then(() => {
  const app = express();
  const server = createServer(app);

  const wss = new WebSocketServer({
    server: server,
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on port ${port}`);
  });

  app.get("*", function (req, res) {
    const parsedUrl = parse(req.url, true);
    const { pathname, query } = parsedUrl;

    handle(req, res, parsedUrl);
  });

  // let io = socket(server);
  // const nsp = io.of("/rtmp");

  wss.on("connection", (ws, req) => {
    console.log("Client connected.");
    const queryString = url.parse(req.url).search;
    const params = new URLSearchParams(queryString);
    const key = params.get("key");

    const rtmpUrl = `rtmps://global-live.mux.com/app/${key}`;

    const ffmpeg = child_process.spawn("ffmpeg", [
      "-i",
      "-",

      // video codec config: low latency, adaptive bitrate
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-tune",
      "zerolatency",

      // audio codec config: sampling frequency (11025, 22050, 44100), bitrate 64 kbits
      "-c:a",
      "aac",
      "-ar",
      "44100",
      "-b:a",
      "64k",

      //force to overwrite
      "-y",

      // used for audio sync
      "-use_wallclock_as_timestamps",
      "1",
      "-async",
      "1",

      //'-filter_complex', 'aresample=44100', // resample audio to 44100Hz, needed if input is not 44100
      //'-strict', 'experimental',
      "-bufsize",
      "1000",
      "-f",
      "flv",

      "-flvflags",
      "no_duration_filesize",
      "-http_persistent",
      "0",

      rtmpUrl,
    ]);

    // Kill the WebSocket connection if ffmpeg dies.
    ffmpeg.on("close", (code, signal) => {
      console.log(
        "FFmpeg child process closed, code " + code + ", signal " + signal
      );
      ws.terminate();
    });

    // Handle STDIN pipe errors by logging to the console.
    // These errors most commonly occur when FFmpeg closes and there is still
    // data to write.f If left unhandled, the server will crash.
    ffmpeg.stdin.on("error", (e) => {
      console.log("FFmpeg STDIN Error", e);
    });

    // FFmpeg outputs all of its messages to STDERR. Let's log them to the console.
    ffmpeg.stderr.on("data", (data) => {
      ws.send("ffmpeg got some data");
      console.log("FFmpeg STDERR:", data.toString());
    });

    ws.on("message", (msg) => {
      if (Buffer.isBuffer(msg)) {
        console.log("this is some video data");
        ffmpeg.stdin.write(msg);
      } else {
        console.log(msg);
      }
    });

    ws.on("close", (e) => {
      ffmpeg.kill("SIGINT");
    });

    ws.on("error", console.error);
  });
  wss.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
  });
});
