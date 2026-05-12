import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Activity, Power, PowerOff, Video, Target, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Minus } from 'lucide-react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<Direction>('NONE');
  const [isActive, setIsActive] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadingText, setLoadingText] = useState('Initializing...');
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>();
  const lastVideoTimeRef = useRef<number>(-1);

  // Initialize HandLandmarker
  useEffect(() => {
    async function initModel() {
      try {
        setLoadingText('Loading Vision tasks...');
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        setLoadingText('Loading Hand Landmarker...');
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-tasks/hand_landmarker/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        landmarkerRef.current = landmarker;
        setIsModelLoaded(true);
        setLoadingText('Ready');
      } catch (err) {
        console.error("Error loading models", err);
        setLoadingText('Error loading models');
      }
    }
    initModel();
  }, []);

  const getDirection = (landmarks: any[]) => {
    // Tip of Index (8), MCP of Index (5)
    // Same physical landmark calculation as backend.
    const tip = landmarks[8];
    const mcp = landmarks[5];
    const dx = tip.x - mcp.x;
    const dy = tip.y - mcp.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Since video is mirrored in CSS (scaleX(-1)), dx > 0 means the point is further right 
      // in the raw frame, which corresponds to the physical left side from user's perspective.
      return dx > 0 ? "LEFT" : "RIGHT"; 
    } else {
      return dy > 0 ? "DOWN" : "UP";
    }
  };

  const predictWebcam = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !canvas || !landmarker || video.readyState < 2) {
      if (isActive) {
        requestRef.current = requestAnimationFrame(predictWebcam);
      }
      return;
    }

    if (lastVideoTimeRef.current !== video.currentTime) {
      lastVideoTimeRef.current = video.currentTime;
      const startTimeMs = performance.now();
      const results = landmarker.detectForVideo(video, startTimeMs);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.landmarks && results.landmarks.length > 0) {
          const drawingUtils = new DrawingUtils(ctx);
          for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(
              landmarks,
              HandLandmarker.HAND_CONNECTIONS,
              { color: "#10b981", lineWidth: 3 } // Emerald 500
            );
            drawingUtils.drawLandmarks(landmarks, { color: "#34d399", lineWidth: 2, radius: 4 }); // Emerald 400
            
            const dir = getDirection(landmarks);
            setDirection(dir);
          }
        } else {
          setDirection('NONE');
        }
        ctx.restore();
      }
    }

    if (isActive) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
  }, [isActive]);

  const startCamera = async () => {
    if (!isModelLoaded) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current && canvasRef.current) {
            videoRef.current.play();
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            setIsActive(true);
          }
        };
      }
    } catch (err) {
      console.error("Error accessing webcam", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setDirection('NONE');
    if (canvasRef.current) {
       const ctx = canvasRef.current.getContext('2d');
       ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  };

  useEffect(() => {
    if (isActive) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, predictWebcam]);

  const DirectionIcon = () => {
    switch(direction) {
      case 'UP': return <ArrowUp className="w-8 h-8 text-emerald-400" />;
      case 'DOWN': return <ArrowDown className="w-8 h-8 text-emerald-400" />;
      case 'LEFT': return <ArrowLeft className="w-8 h-8 text-emerald-400" />;
      case 'RIGHT': return <ArrowRight className="w-8 h-8 text-emerald-400" />;
      default: return <Minus className="w-8 h-8 text-zinc-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-4xl flex flex-col border border-zinc-800 rounded-xl bg-[#0a0a0a] shadow-[0_30px_60px_rgba(0,0,0,0.5)] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-emerald-500 rounded">
              <Camera className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-lg text-zinc-100 uppercase">Hand Tracker <span className="text-emerald-500 font-mono text-[10px] ml-2 px-2 py-0.5 border border-emerald-500/30 bg-emerald-500/10 rounded tracking-normal">OS V2.4</span></h1>
              <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase mt-0.5">{loadingText}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="flex flex-col items-end">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">System Status</span>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    {isActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isActive ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
                  </span>
                  <span className={`text-xs ${isActive ? 'text-emerald-400' : 'text-zinc-400'} font-mono`}>{isActive ? 'Camera Connected' : 'Standby'}</span>
                </div>
             </div>
             <div className="h-8 w-[1px] bg-zinc-800 hidden sm:block"></div>
             <button 
               disabled={!isModelLoaded}
               onClick={isActive ? stopCamera : startCamera}
               className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors border
                 ${!isModelLoaded ? 'bg-zinc-800/50 border-zinc-700 text-zinc-500 cursor-not-allowed' : 
                   isActive ? 'bg-red-600/10 border-red-500/50 text-red-400 hover:bg-red-600/20' : 
                              'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20'}`}
             >
               {isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
               {isActive ? 'Terminate Process' : 'Initialize Tracking'}
             </button>
          </div>
        </div>

        {/* Main Content Viewport */}
        <div className="relative aspect-video bg-[#111] flex flex-col overflow-hidden" ref={containerRef}>
            {!isActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-zinc-600">
                <Video className="w-16 h-16 mb-4 opacity-30" />
                <p className="font-bold text-[11px] uppercase tracking-widest">Camera Feed Offline</p>
                <p className="text-xs mt-2 font-mono text-zinc-500">{isModelLoaded ? 'Press Initialize Tracking to begin stream' : 'Waiting for model...'}</p>
              </div>
            )}
            
            {/* 
              Scale-x-[-1] mirrors the video and canvas so the user moves naturally like looking in a mirror. 
            */}
            <div className="absolute inset-0 scale-x-[-1]">
                <video 
                  ref={videoRef} 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover"
                ></video>
                <canvas 
                  ref={canvasRef} 
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                ></canvas>
            </div>

            {/* Crosshairs/Overlays purely for UI flair */}
            {isActive && (
               <>
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none">
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-zinc-800/80"></div>
                   <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[1px] w-full bg-zinc-800/80"></div>
                 </div>
                 
                 <div className="absolute top-6 left-6 font-mono pointer-events-none">
                   <div className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 inline-block mb-1">PROCESSED_FEED_01</div>
                   <div className="text-2xl font-bold tracking-tight text-white drop-shadow-md">POINTING: {direction}</div>
                 </div>

                 <div className="absolute bottom-6 right-6 font-mono text-[10px] text-zinc-400 bg-zinc-900/50 px-2 py-1 rounded backdrop-blur border border-zinc-800 pointer-events-none">
                   RESO: 1280 x 720<br/>ENCODE: MP_SRGB
                 </div>
               </>
            )}
        </div>

        {/* Footer Metrics */}
        <div className="grid grid-cols-3 bg-zinc-900/30 border-t border-zinc-800">
            <div className="p-5 border-r border-zinc-800 flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-800/20 border border-zinc-800/50 rounded flex items-center justify-center">
                 <Target className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Pointer Status</p>
                <p className="text-sm font-mono tracking-wide text-zinc-300">{direction !== 'NONE' ? 'DETECTING' : 'IDLE / SEARCHING'}</p>
              </div>
            </div>

            <div className={`p-5 border-r border-zinc-800 flex items-center gap-4 relative overflow-hidden transition-colors duration-300 ${direction !== 'NONE' ? 'bg-zinc-800/40' : ''}`}>
              <div className={`w-12 h-12 rounded border flex items-center justify-center transition-colors duration-300 relative z-10 ${direction !== 'NONE' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-800/20 border-zinc-800/50'}`}>
                 <DirectionIcon />
              </div>
              <div className="relative z-10">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Direction Vector</p>
                <p className={`text-xl font-mono font-bold tracking-widest ${direction !== 'NONE' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {direction !== 'NONE' ? direction : '--'}
                </p>
              </div>
            </div>

            <div className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-800/20 border border-zinc-800/50 rounded flex items-center justify-center">
                 <Activity className="w-5 h-5 text-emerald-500/80" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Tracking Engine</p>
                <p className="text-sm font-mono tracking-wide text-zinc-300">MediaPipe AI</p>
              </div>
            </div>
        </div>
      </div>
      
      <div className="mt-8 text-[11px] text-zinc-600 font-mono text-center max-w-xl uppercase tracking-widest">
        Warning: For demonstration purposes only. Allow camera permissions to begin tracking.
        Ensure your hand is clearly visible in the camera frame.
      </div>
    </div>
  );
}
