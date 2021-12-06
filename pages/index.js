import React, { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import Head from "next/head";
import styles from "../styles/demo.module.css";

const CAMERA_CONSTRAINTS = {
  audio: true,
  video: true,
};

export default () => {
  const [connected, setConnected] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamKey, setStreamKey] = useState(null);
  const [textOverlay, setTextOverlay] = useState("Fastsento live");

  const inputStreamRef = useRef();
  const videoRef = useRef();
  const canvasRef = useRef();
  const wsRef = useRef();
  const mediaRecorderRef = useRef();
  const requestAnimationRef = useRef();
  const nameRef = useRef();

  const enableCamera = async () => {
    inputStreamRef.current = await navigator.mediaDevices.getUserMedia(
      CAMERA_CONSTRAINTS
    );

    videoRef.current.srcObject = inputStreamRef.current;

    await videoRef.current.play();

    // We need to set the canvas height/width to match the video element.
    canvasRef.current.height = videoRef.current.clientHeight;
    canvasRef.current.width = videoRef.current.clientWidth;

    requestAnimationRef.current = requestAnimationFrame(updateCanvas);

    setCameraEnabled(true);
    var url = new URL(window.location);
    var key = url.searchParams.get("key");
    if (key) {
      setStreamKey(key);
      const protocol = window.location.protocol.replace("http", "ws");
      const wsUrl = `${protocol}//${window.location.host}/rtmp?key=${key}`;
      wsRef.current = io(wsUrl);

      wsRef.current.on("connect", function (ws) {
        console.log("Connected to Stream Server");
        wsRef.current.on("event", function (data) {
          console.log("Ping " + data);
          console.log(now + "   " + Date.now());
        });
      });
      startStreaming();
    }
  };

  const updateCanvas = () => {
    if (videoRef.current.ended || videoRef.current.paused) {
      return;
    }

    const ctx = canvasRef.current.getContext("2d");

    ctx.drawImage(
      videoRef.current,
      0,
      0,
      videoRef.current.clientWidth,
      videoRef.current.clientHeight
    );

    ctx.fillStyle = "#FB3C4E";
    ctx.font = "50px Akkurat";
    ctx.fillText(nameRef.current, 10, 50, canvasRef.current.width - 20);

    requestAnimationRef.current = requestAnimationFrame(updateCanvas);
  };

  const stopStreaming = () => {
    if (mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    setStreaming(false);
  };

  const startStreaming = () => {
    setStreaming(true);

    const videoOutputStream = canvasRef.current.captureStream(30); // 30 FPS

    wsRef.current.addEventListener("open", function open() {
      setConnected(true);
    });

    wsRef.current.addEventListener("close", () => {
      setConnected(false);
      stopStreaming();
    });

    // Let's do some extra work to get audio to join the party.
    // https://hacks.mozilla.org/2016/04/record-almost-everything-in-the-browser-with-mediarecorder/
    const audioStream = new MediaStream();
    const audioTracks = inputStreamRef.current.getAudioTracks();
    audioTracks.forEach(function (track) {
      audioStream.addTrack(track);
    });

    const outputStream = new MediaStream();
    [audioStream, videoOutputStream].forEach(function (s) {
      s.getTracks().forEach(function (t) {
        outputStream.addTrack(t);
      });
    });

    mediaRecorderRef.current = new MediaRecorder(outputStream, {
      mimeType: "video/webm",
      videoBitsPerSecond: 3000000,
    });

    mediaRecorderRef.current.addEventListener("dataavailable", (e) => {
      wsRef.current.send(e.data);
    });

    mediaRecorderRef.current.addEventListener("stop", () => {
      stopStreaming();
      wsRef.current.close();
    });

    mediaRecorderRef.current.start(1000);
  };

  useEffect(() => {
    nameRef.current = textOverlay;
  }, [textOverlay]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(requestAnimationRef.current);
    };
  }, []);

  return (
    <div className={styles.container}>
      <Head>
        <title>Fastsento Live</title>
      </Head>

      <div className={styles.info}>
        <h1>Fastsento Live</h1>
        {cameraEnabled && streaming && (
          <div>
            <span
              className={`${styles.streamStatus} ${
                connected ? styles.connected : styles.disconnected
              }`}
            >
              {connected ? "Connected" : "Disconnected"}
            </span>

            <button onClick={stopStreaming}>Stop Streaming</button>
          </div>
        )}
      </div>
      <div
        className={`${styles.videoContainer} ${
          cameraEnabled && styles.cameraEnabled
        }`}
      >
        {!cameraEnabled && (
          <button className={styles.startButton} onClick={enableCamera}>
            Start streaming
          </button>
        )}
        <div className={styles.inputVideo}>
          <video ref={videoRef} muted playsInline></video>
        </div>
        <div className={styles.outputCanvas}>
          <canvas ref={canvasRef}></canvas>
        </div>
      </div>
    </div>
  );
};
