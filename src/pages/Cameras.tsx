import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Camera as CameraIcon, Image as ImageIcon, RotateCcw, Square, Upload, Video } from 'lucide-react';
import { CameraErrorInfo, CameraFacingMode, CameraStreamState, Detection, IncidentStatus, PersonSafety, RiskLevel, VisionFrameResult } from '../types';
import { checkBackendHealth, createInferenceController, resetInferenceSession, sendFrameForInference } from '../services/visionService';
import { isCameraSupported, startCameraStream, stopCameraStream } from '../services/cameraService';
import { useSafety } from '../context/SafetyContext';
import { useFactory } from '../context/FactoryContext';

type InputMode = 'LIVE_CAMERA' | 'RECORDED_VIDEO' | 'IMAGE';
type InferenceState = 'IDLE' | 'ANALYZING' | 'READY' | 'STOPPED' | 'ERROR';

function displayLabel(detection: Detection): string {
  return detection.className.replaceAll('_', ' ');
}

const requiredPpe = ['Helmet', 'Vest', 'Boots', 'Glove', 'Mask'];

function PersonComplianceOverlay({ person, style }: { person: PersonSafety; style?: React.CSSProperties }) {
  const violation = person.violationTypes.length > 0;
  const compliant = person.visible && requiredPpe.every((name) => ['CONFIRMED', 'COMPLIANT'].includes(person.ppeStates[name]));
  const borderClass = violation ? 'border-rose-500' : compliant ? 'border-emerald-400' : 'border-amber-400';
  const labelClass = violation ? 'bg-rose-500' : compliant ? 'bg-emerald-400' : 'bg-amber-400';
  const stateLabel = violation ? 'PPE VIOLATION' : compliant ? 'PPE COMPLIANT' : 'PPE STATUS UNCERTAIN';
  const missing = person.violationTypes.map((violationType) => violationType.replace(/^Missing /, ''));

  const defaultStyle: React.CSSProperties = {
    left: `${person.boundingBox.x * 100}%`,
    top: `${person.boundingBox.y * 100}%`,
    width: `${person.boundingBox.width * 100}%`,
    height: `${person.boundingBox.height * 100}%`,
  };

  return <div className={`pointer-events-none absolute border-2 ${borderClass}`} style={style || defaultStyle}>
    <div className={`absolute left-0 top-0 min-w-max ${labelClass} px-1.5 py-1 text-[10px] font-semibold text-slate-950 shadow-md`}>
      <div>ID {person.trackId} | {stateLabel}</div>
      <div>{requiredPpe.map((name) => `${['CONFIRMED', 'COMPLIANT'].includes(person.ppeStates[name]) ? '✓' : person.ppeStates[name] === 'VIOLATION' ? '✗' : '•'} ${name}`).join('  ')}</div>
      {violation && <div>Missing: {missing.join(', ')}</div>}
    </div>
  </div>;
}

export default function Cameras() {
  const { addIncident, setCameraOperationalStatus } = useSafety();
  const { dispatch: factoryDispatch } = useFactory();
  const [mode, setMode] = useState<InputMode>('LIVE_CAMERA');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [streamState, setStreamState] = useState(CameraStreamState.IDLE);
  const [cameraError, setCameraError] = useState<CameraErrorInfo | null>(null);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [backendReason, setBackendReason] = useState('Vision backend unavailable.');
  const [inferenceState, setInferenceState] = useState<InferenceState>('IDLE');
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [result, setResult] = useState<VisionFrameResult | null>(null);
  const [detectionActive, setDetectionActive] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [mediaLayout, setMediaLayout] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });

  const updateMediaLayout = useCallback(() => {
    const container = containerRef.current;
    const media = mode === 'IMAGE' ? imageRef.current : videoRef.current;
    if (!container) return;

    const cWidth = container.clientWidth;
    const cHeight = container.clientHeight;
    const mWidth = (media instanceof HTMLVideoElement ? media.videoWidth : (media as HTMLImageElement)?.naturalWidth) || cWidth;
    const mHeight = (media instanceof HTMLVideoElement ? media.videoHeight : (media as HTMLImageElement)?.naturalHeight) || cHeight;

    if (!mWidth || !mHeight || !cWidth || !cHeight) {
      setMediaLayout({ width: cWidth, height: cHeight, offsetX: 0, offsetY: 0 });
      return;
    }

    const mediaAspect = mWidth / mHeight;
    const containerAspect = cWidth / cHeight;

    let renderWidth = cWidth;
    let renderHeight = cHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > mediaAspect) {
      renderHeight = cHeight;
      renderWidth = renderHeight * mediaAspect;
      offsetX = (cWidth - renderWidth) / 2;
    } else {
      renderWidth = cWidth;
      renderHeight = renderWidth / mediaAspect;
      offsetY = (cHeight - renderHeight) / 2;
    }

    setMediaLayout({ width: renderWidth, height: renderHeight, offsetX, offsetY });
  }, [mode]);

  useEffect(() => {
    updateMediaLayout();
    window.addEventListener('resize', updateMediaLayout);
    return () => window.removeEventListener('resize', updateMediaLayout);
  }, [updateMediaLayout, stream, videoUrl, imageUrl]);

  const getOverlayStyle = useCallback(
    (bbox: { x: number; y: number; width: number; height: number }): React.CSSProperties => {
      const isMirrored = mode === 'LIVE_CAMERA' && facingMode === 'user';
      const displayX = isMirrored ? 1 - bbox.x - bbox.width : bbox.x;

      if (!mediaLayout.width || !mediaLayout.height) {
        return {
          left: `${displayX * 100}%`,
          top: `${bbox.y * 100}%`,
          width: `${bbox.width * 100}%`,
          height: `${bbox.height * 100}%`,
        };
      }

      return {
        left: `${mediaLayout.offsetX + displayX * mediaLayout.width}px`,
        top: `${mediaLayout.offsetY + bbox.y * mediaLayout.height}px`,
        width: `${bbox.width * mediaLayout.width}px`,
        height: `${bbox.height * mediaLayout.height}px`,
      };
    },
    [facingMode, mediaLayout, mode]
  );

  const handleInferenceResult = useCallback((nextResult: VisionFrameResult) => {
    setResult(nextResult);
    setInferenceState('READY');
    setInferenceError(null);
    nextResult.incidents?.forEach((incident) => {
      addIncident({
        incidentId: incident.incidentId,
        workerId: `TRACK-${incident.trackId}`,
        trackId: incident.trackId,
        violation: incident.violationType,
        severity: RiskLevel.HIGH,
        cameraId: incident.cameraId,
        zoneId: incident.zone,
        confidence: incident.confidence,
        frameNumber: incident.frameNumber,
        evidenceImage: incident.evidenceImage,
      });
      factoryDispatch({
        type: 'ADD_INCIDENTS',
        incidents: [
          {
            incidentId: incident.incidentId,
            workerId: `TRACK-${incident.trackId}`,
            trackId: incident.trackId,
            cameraId: incident.cameraId,
            zoneId: incident.zone || 'ZONE-01',
            violation: incident.violationType,
            severity: RiskLevel.HIGH,
            timestamp: incident.timestamp,
            status: IncidentStatus.OPEN,
            confidence: incident.confidence,
            frameNumber: incident.frameNumber,
            evidenceImage: incident.evidenceImage,
          },
        ],
      });
    });
  }, [addIncident, factoryDispatch]);

  useEffect(() => {
    let mounted = true;
    const refreshBackendHealth = () => checkBackendHealth().then((health) => {
      if (mounted) {
        setBackendReady(health?.engineReady === true);
        setBackendReason(health?.engineReady ? '' : health?.engineReason || 'AI detection model is not connected.');
      }
    });
    refreshBackendHealth();
    const healthInterval = window.setInterval(refreshBackendHealth, 3000);
    return () => { mounted = false; window.clearInterval(healthInterval); };
  }, []);
  useEffect(() => () => { stopCameraStream(stream); if (videoUrl) URL.revokeObjectURL(videoUrl); if (imageUrl) URL.revokeObjectURL(imageUrl); }, [stream, videoUrl, imageUrl]);
  useEffect(() => { setCameraOperationalStatus(streamState === CameraStreamState.LIVE ? 'ACTIVE' : streamState === CameraStreamState.ERROR ? 'ERROR' : streamState === CameraStreamState.REQUESTING_PERMISSION ? 'REQUESTING' : 'OFFLINE'); }, [setCameraOperationalStatus, streamState]);
  useEffect(() => { if (videoRef.current && mode === 'LIVE_CAMERA') { videoRef.current.srcObject = stream; if (stream) videoRef.current.play().catch(() => undefined); } }, [mode, stream]);
  useEffect(() => {
    const isAnalyzable = mode === 'LIVE_CAMERA' ? !!stream : mode === 'RECORDED_VIDEO' && !!videoUrl;
    if (!detectionActive || !isAnalyzable || !backendReady || !videoRef.current) return;
    const cameraId = mode === 'LIVE_CAMERA' ? 'CAM-01' : 'RECORDED-VIDEO';
    resetInferenceSession(cameraId);
    const controller = createInferenceController({
      videoElement: videoRef.current,
      cameraId,
      source: mode === 'LIVE_CAMERA' ? 'webcam' : 'video',
      fps: mode === 'LIVE_CAMERA' ? 5 : 10,
      onResult: handleInferenceResult,
      onError: (error) => { setInferenceError(error.message); setInferenceState('ERROR'); },
    });
    setInferenceState('ANALYZING');
    controller.start();
    return () => controller.stop();
  }, [backendReady, detectionActive, handleInferenceResult, mode, stream, videoUrl]);

  const startCamera = useCallback(async () => {
    setCameraError(null); setStreamState(CameraStreamState.REQUESTING_PERMISSION);
    try { const nextStream = await startCameraStream({ facingMode }); setStream(nextStream); setStreamState(CameraStreamState.LIVE); }
    catch (error) { setCameraError(error as CameraErrorInfo); setStream(null); setStreamState(CameraStreamState.ERROR); }
  }, [facingMode]);
  const stopCamera = () => { stopDetection(); stopCameraStream(stream); setStream(null); setStreamState(CameraStreamState.STOPPED); };
  const switchCamera = async () => {
    const nextFacingMode: CameraFacingMode = facingMode === 'user' ? 'environment' : 'user';
    stopDetection();
    stopCameraStream(stream); setStream(null); setFacingMode(nextFacingMode); setCameraError(null); setStreamState(CameraStreamState.REQUESTING_PERMISSION);
    try { const nextStream = await startCameraStream({ facingMode: nextFacingMode }); setStream(nextStream); setStreamState(CameraStreamState.LIVE); }
    catch (error) { setCameraError(error as CameraErrorInfo); setStreamState(CameraStreamState.ERROR); }
  };
  const stopDetection = () => {
    const cameraId = mode === 'LIVE_CAMERA' ? 'CAM-01' : 'RECORDED-VIDEO';
    setDetectionActive(false);
    resetInferenceSession(cameraId);
    setInferenceState('STOPPED');
  };

  const switchMode = (nextMode: InputMode) => {
    stopDetection();
    if (nextMode !== 'LIVE_CAMERA') stopCamera();
    setMode(nextMode);
    setInferenceError(null);
    setResult(null);
  };

  const startDetection = async () => {
    const hasSource = mode === 'LIVE_CAMERA' ? !!stream : mode === 'RECORDED_VIDEO' ? !!videoUrl : !!imageFile;
    if (!hasSource || !backendReady || detectionActive) return;
    setInferenceError(null);
    setDetectionActive(true);
    setInferenceState('ANALYZING');
    if (mode === 'IMAGE' && imageFile) {
      try {
        const response = await sendFrameForInference(imageFile, 'IMAGE-01', 'image');
        handleInferenceResult(response);
      } catch (error) {
        setInferenceError(error instanceof Error ? error.message : 'Image inference failed.');
        setInferenceState('ERROR');
      } finally {
        setDetectionActive(false);
      }
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>, kind: 'video' | 'image') => {
    const file = event.target.files?.[0]; if (!file) return;
    const valid = kind === 'video' ? file.type.startsWith('video/') : file.type.startsWith('image/');
    if (!valid) { setInferenceError(`Please choose a valid ${kind} file.`); event.target.value = ''; return; }
    const nextUrl = URL.createObjectURL(file);
    if (kind === 'video') { if (videoUrl) URL.revokeObjectURL(videoUrl); setVideoUrl(nextUrl); switchMode('RECORDED_VIDEO'); }
    else { if (imageUrl) URL.revokeObjectURL(imageUrl); setImageUrl(nextUrl); setImageFile(file); switchMode('IMAGE'); }
    event.target.value = '';
  };

  const statusLabel = streamState === CameraStreamState.LIVE ? 'Camera Active' : streamState === CameraStreamState.REQUESTING_PERMISSION ? 'Requesting Permission' : streamState === CameraStreamState.ERROR ? 'Camera Error' : streamState === CameraStreamState.STOPPED ? 'Camera Stopped' : 'Camera Offline';
  const engineLabel = !backendReady ? 'AI Detection Ready - Model Not Connected' : detectionActive ? 'AI Detection Active' : inferenceState === 'STOPPED' ? 'AI Detection Stopped' : 'AI Detection Ready';
  const hasDetectionSource = mode === 'LIVE_CAMERA' ? !!stream : mode === 'RECORDED_VIDEO' ? !!videoUrl : !!imageFile;

  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">SURVEILLANCE INPUT</p><h1 className="mt-2 text-3xl font-bold text-white">Cameras</h1><p className="mt-1 text-sm text-slate-400">Choose a real source to prepare for PPE inference.</p></header>
    <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">{([['LIVE_CAMERA', 'Live Camera', CameraIcon], ['RECORDED_VIDEO', 'Recorded Video', Video], ['IMAGE', 'Image', ImageIcon]] as const).map(([value, label, Icon]) => <button key={value} onClick={() => switchMode(value)} className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold ${mode === value ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}><Icon size={16} />{label}</button>)}</div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-black">
        <div ref={containerRef} className="relative flex aspect-video items-center justify-center bg-slate-950">
          {mode === 'LIVE_CAMERA' && <div className="relative h-full w-full"><video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={updateMediaLayout} className={`h-full w-full object-contain ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />{result?.detections.map((detection) => <div key={detection.detectionId} className="pointer-events-none absolute border-2 border-amber-400" style={getOverlayStyle(detection.boundingBox)}><span className="absolute left-0 top-0 whitespace-nowrap bg-amber-400 px-1 text-[10px] font-semibold text-slate-950 shadow">{displayLabel(detection)} {Math.round(detection.confidence * 100)}%</span></div>)}{result?.persons?.map((person) => <PersonComplianceOverlay key={`live-person-${person.trackId}`} person={person} style={getOverlayStyle(person.boundingBox)} />)}</div>}
          {mode === 'RECORDED_VIDEO' && videoUrl && <div className="relative h-full w-full"><video ref={videoRef} src={videoUrl} controls onLoadedMetadata={updateMediaLayout} className="h-full w-full object-contain" />{result?.detections.map((detection) => <div key={detection.detectionId} className="pointer-events-none absolute border-2 border-amber-400" style={getOverlayStyle(detection.boundingBox)}><span className="absolute left-0 top-0 whitespace-nowrap bg-amber-400 px-1 text-[10px] font-semibold text-slate-950 shadow">{displayLabel(detection)} {Math.round(detection.confidence * 100)}%</span></div>)}{result?.persons?.map((person) => <PersonComplianceOverlay key={`person-${person.trackId}`} person={person} style={getOverlayStyle(person.boundingBox)} />)}</div>}
          {mode === 'IMAGE' && imageUrl && <div className="relative h-full w-full"><img ref={imageRef} src={imageUrl} alt="Selected safety source" onLoad={updateMediaLayout} className="h-full w-full object-contain" />{result?.detections.map((detection) => <div key={detection.detectionId} className="pointer-events-none absolute border-2 border-amber-400" style={getOverlayStyle(detection.boundingBox)}><span className="absolute left-0 top-0 whitespace-nowrap bg-amber-400 px-1 text-[10px] font-semibold text-slate-950 shadow">{displayLabel(detection)} {Math.round(detection.confidence * 100)}%</span></div>)}{result?.persons?.map((person) => <PersonComplianceOverlay key={`img-person-${person.trackId}`} person={person} style={getOverlayStyle(person.boundingBox)} />)}</div>}
          {((mode === 'RECORDED_VIDEO' && !videoUrl) || (mode === 'IMAGE' && !imageUrl)) && <div className="p-8 text-center text-sm text-slate-500">{mode === 'IMAGE' ? 'Upload an image to begin analysis.' : 'Upload a recorded video to begin analysis.'}</div>}
          {mode === 'LIVE_CAMERA' && !stream && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-6 text-center"><CameraIcon className="text-slate-600" size={40} /><p className="text-sm text-slate-400">{cameraError?.message || inferenceError || statusLabel}</p>{isCameraSupported() && <button onClick={startCamera} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Start Camera</button>}</div>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900 px-4 py-3"><span className="text-sm text-slate-300">Source: <strong>{mode === 'LIVE_CAMERA' ? 'LIVE CAMERA' : mode === 'RECORDED_VIDEO' ? 'RECORDED VIDEO' : 'IMAGE'}</strong></span><div className="flex flex-wrap gap-2">{mode === 'LIVE_CAMERA' && stream && <><button onClick={stopCamera} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200"><Square size={13} />Stop Camera</button><button onClick={switchCamera} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200"><RotateCcw size={13} />Switch Camera</button></>}{mode === 'RECORDED_VIDEO' && <button onClick={() => videoInputRef.current?.click()} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"><Upload size={13} />Upload Video</button>}{mode === 'IMAGE' && <button onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"><Upload size={13} />Upload Image</button>}<button onClick={detectionActive ? stopDetection : startDetection} disabled={!hasDetectionSource || !backendReady} className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${detectionActive ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{detectionActive ? <Square size={13} /> : <Video size={13} />}{detectionActive ? 'Stop PPE Detection' : 'Start PPE Detection'}</button></div></div>
      </section>
          <aside className="rounded-xl border border-slate-800 bg-slate-900/70 p-5"><h2 className="text-lg font-semibold text-white">AI Detection</h2><div className="mt-4 border-l-2 border-amber-400 pl-3"><p className="text-sm font-semibold text-amber-300">{engineLabel}</p><p className="mt-1 text-xs leading-5 text-slate-400">{inferenceState === 'ERROR' ? inferenceError : !backendReady ? backendReason : backendReady && result ? `${result.detections.length} detections returned` : 'Awaiting AI Inference'}</p></div>{result?.persons?.map((person) => <div key={`status-${person.trackId}`} className="mt-4 border-t border-slate-800 pt-3"><p className="text-xs font-semibold text-cyan-300">TRACK ID {person.trackId}</p>{Object.entries(person.ppeStates).map(([name, state]) => <div key={name} className="mt-1 flex justify-between text-xs"><span className="text-slate-400">{name}</span><span className={state === 'VIOLATION' ? 'text-rose-300' : state === 'CONFIRMED' || state === 'COMPLIANT' ? 'text-emerald-300' : 'text-amber-300'}>{state}</span></div>)}</div>)}{result && <dl className="mt-6 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Source</dt><dd className="text-slate-300">{result.source || 'image'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Detections</dt><dd className="text-slate-300">{result.detections.length}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Timestamp</dt><dd className="text-slate-400">{new Date(result.timestamp).toLocaleTimeString()}</dd></div></dl>}<p className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-500">States are returned by the CUDA tracking and temporal PPE pipeline.</p></aside>
    </div>
    <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => handleFile(event, 'video')} className="hidden" /><input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleFile(event, 'image')} className="hidden" />
  </div>;
}
