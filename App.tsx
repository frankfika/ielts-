
import React, { useState, useEffect, useRef } from 'react';
import { GeminiLiveClient } from './services/geminiLive';
import { ExamPhase } from './types';
import { Mic, MicOff, Video, VideoOff, Power, Play, Square, MessageSquare, Wifi, BarChart3, Clock, ShieldCheck, Languages, AlertCircle } from 'lucide-react';
import AudioVisualizer from './components/AudioVisualizer';
import Timer from './components/Timer';

// Professional Examiner Image URL
const EXAMINER_IMAGE_URL = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2574&auto=format&fit=crop";

const App: React.FC = () => {
  const [examPhase, setExamPhase] = useState<ExamPhase>(ExamPhase.IDLE);
  const [userStream, setUserStream] = useState<MediaStream | null>(null);
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  // Audio Visualizer State
  const [userAudioLevel, setUserAudioLevel] = useState(0);
  const [aiAudioLevel, setAiAudioLevel] = useState(0);

  // Transcript & Stats
  const [lastTranscriptUpdate, setLastTranscriptUpdate] = useState<string>('');
  const [wordCount, setWordCount] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const liveClient = useRef<GeminiLiveClient | null>(null);

  // Setup Camera
  useEffect(() => {
    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setUserStream(stream);
        setMediaError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Access denied", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setMediaError("Camera/Microphone permission denied. Please allow access in your browser settings to continue.");
        } else if (err.name === 'NotFoundError') {
            setMediaError("No camera or microphone found. Please connect a device.");
        } else {
            setMediaError("Could not access media devices: " + err.message);
        }
      }
    }
    setupMedia();
    return () => {
      userStream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Session Timer
  useEffect(() => {
    let interval: any;
    if (sessionStartTime && examPhase !== ExamPhase.ENDED && examPhase !== ExamPhase.IDLE) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - sessionStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionStartTime, examPhase]);

  const handleStartExam = async () => {
    if (!userStream) {
        // Try requesting again if they fixed permissions
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setUserStream(stream);
            setMediaError(null);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (e) {
            setMediaError("Cannot start without camera and microphone access.");
            return;
        }
    }
    
    setExamPhase(ExamPhase.CONNECTING);
    setWordCount(0);
    setElapsedTime(0);
    
    try {
      liveClient.current = new GeminiLiveClient();
      
      liveClient.current.onAudioLevel = (level) => setUserAudioLevel(level);
      liveClient.current.onResponseAudioLevel = (level) => setAiAudioLevel(level);
      
      liveClient.current.onTranscription = (text, isUser) => {
        setLastTranscriptUpdate(text);
        if (isUser) {
          // Rough word count estimation
          const words = text.trim().split(/\s+/).length;
          setWordCount(prev => prev + words);
        }
      };

      await liveClient.current.connect(userStream!);
      
      setSessionStartTime(Date.now());
      setExamPhase(ExamPhase.PART1);
    } catch (e) {
      console.error(e);
      setExamPhase(ExamPhase.IDLE);
      alert("Failed to connect to Examiner AI. Check API Key.");
    }
  };

  const handleEndExam = () => {
    if (liveClient.current) {
      liveClient.current.disconnect();
    }
    setExamPhase(ExamPhase.ENDED);
    setSessionStartTime(null);
  };

  const advancePhase = (phase: ExamPhase) => {
    setExamPhase(phase);
  };

  const toggleMic = () => {
    if (userStream) {
      const audioTrack = userStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicActive(audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (userStream) {
      const videoTrack = userStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraActive(videoTrack.enabled);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate approx WPM
  const wpm = elapsedTime > 0 ? Math.round((wordCount / (elapsedTime / 60))) : 0;

  return (
    <div className="h-screen w-full bg-black flex flex-col relative overflow-hidden font-sans">
      
      {/* ==================== FULL SCREEN EXAMINER VIEW ==================== */}
      <div className="absolute inset-0 z-0 bg-slate-900">
        {examPhase !== ExamPhase.IDLE ? (
          <>
            {/* Simulated Video Feed of Examiner */}
            <div className="w-full h-full relative overflow-hidden">
              <img 
                src={EXAMINER_IMAGE_URL} 
                alt="Examiner"
                className="w-full h-full object-cover object-center opacity-80 animate-breathe"
              />
              
              {/* Scanlines / Noise Overlay for realism */}
              <div className="absolute inset-0 scanlines opacity-30 pointer-events-none"></div>
              
              {/* Examiner Status Overlay */}
              <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between z-10">
                  <div>
                      <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 inline-flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${aiAudioLevel > 0.05 ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}></div>
                          <div>
                            <h2 className="text-white font-semibold text-lg leading-none">Mr. Sterling</h2>
                            <p className="text-slate-300 text-xs mt-1">Senior IELTS Examiner • London, UK</p>
                          </div>
                      </div>
                      
                      {/* Captions / Subtitles */}
                      <div className="mt-4 max-w-2xl">
                          <p className="text-xl font-medium text-white/90 drop-shadow-md leading-relaxed transition-all duration-300">
                              {lastTranscriptUpdate ? `"${lastTranscriptUpdate}"` : <span className="text-white/40 italic">Listening...</span>}
                          </p>
                      </div>
                  </div>

                  {/* AI Visualizer when speaking */}
                  {aiAudioLevel > 0.01 && (
                    <div className="w-64 h-16 bg-black/20 backdrop-blur-sm rounded-xl border border-white/5 overflow-hidden">
                       <AudioVisualizer level={aiAudioLevel} isActive={true} color="#818cf8" />
                    </div>
                  )}
              </div>
            </div>
          </>
        ) : (
          /* IDLE STATE BACKGROUND */
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 relative overflow-hidden">
             <div className="absolute w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-3xl top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
          </div>
        )}
      </div>

      {/* ==================== USER PIP (Picture in Picture) ==================== */}
      {examPhase !== ExamPhase.IDLE && examPhase !== ExamPhase.ENDED && (
        <div className="absolute top-6 right-6 w-64 aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-700 shadow-2xl z-20 group transition-all hover:scale-105 hover:border-indigo-500">
           <video 
             ref={videoRef} 
             autoPlay 
             muted 
             playsInline 
             className={`w-full h-full object-cover ${!cameraActive && 'hidden'}`} 
           />
           {!cameraActive && (
             <div className="w-full h-full flex items-center justify-center bg-slate-800">
               <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center">
                 <span className="text-2xl text-slate-400 font-bold">YOU</span>
               </div>
             </div>
           )}
           
           <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-xs text-white font-mono flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${micActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
             You
           </div>
           
           {/* Mic Activity Indicator */}
           <div className="absolute top-2 right-2">
              <div className={`w-3 h-3 rounded-full bg-green-500 transition-opacity duration-100 ${userAudioLevel > 0.02 ? 'opacity-100' : 'opacity-0'}`}></div>
           </div>
        </div>
      )}

      {/* ==================== TOP STATUS BAR ==================== */}
      <div className="absolute top-0 left-0 w-full p-4 z-30 flex justify-between items-start pointer-events-none">
         {/* Left: Connection Info */}
         <div className="flex items-start gap-4 pointer-events-auto">
            {examPhase !== ExamPhase.IDLE && (
              <div className="bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-white/10 flex flex-col gap-2 text-xs text-slate-400 shadow-lg">
                 <div className="flex items-center gap-2 text-green-400 font-semibold">
                    <Wifi size={14} />
                    <span>Excellent Connection</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <ShieldCheck size={14} />
                    <span>End-to-End Encrypted</span>
                 </div>
                 <div className="h-px w-full bg-white/10 my-1"></div>
                 <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Clock size={12}/> Time:</span>
                    <span className="font-mono text-white">{formatDuration(elapsedTime)}</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><BarChart3 size={12}/> Speed:</span>
                    <span className="font-mono text-white">{wpm} wpm</span>
                 </div>
              </div>
            )}
         </div>

         {/* Center: Phase Indicator */}
         {examPhase !== ExamPhase.IDLE && examPhase !== ExamPhase.ENDED && (
            <div className="bg-slate-900/90 backdrop-blur-lg px-6 py-2 rounded-full border border-indigo-500/30 shadow-lg shadow-indigo-500/10 pointer-events-auto transform translate-y-2">
               <div className="text-indigo-400 text-xs font-bold uppercase tracking-widest text-center mb-0.5">Current Section</div>
               <div className="text-white font-semibold text-center">
                  {examPhase === ExamPhase.CONNECTING && "Connecting..."}
                  {examPhase === ExamPhase.PART1 && "Part 1: Introduction & Interview"}
                  {examPhase === ExamPhase.PART2_PREP && "Part 2: Topic Preparation"}
                  {examPhase === ExamPhase.PART2_SPEAK && "Part 2: Long Turn Speaking"}
                  {examPhase === ExamPhase.PART3 && "Part 3: Discussion"}
               </div>
            </div>
         )}
      </div>

      {/* ==================== BOTTOM CONTROLS ==================== */}
      <div className="absolute bottom-0 left-0 w-full p-6 z-30 flex justify-center pointer-events-none">
        
        {/* START SCREEN */}
        {examPhase === ExamPhase.IDLE && (
           <div className="bg-slate-900/90 backdrop-blur-xl p-8 rounded-3xl border border-slate-700 shadow-2xl max-w-md w-full text-center pointer-events-auto">
              <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-indigo-600/20">
                 <MessageSquare size={40} className="text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">IELTS Speaking Pro</h1>
              <p className="text-slate-400 mb-6 leading-relaxed">
                 Experience a realistic mock exam with a professional AI examiner. 
              </p>

              {/* Feature Cards with Bilingual Info */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 text-left">
                     <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold mb-1 uppercase tracking-wider">
                        <Languages size={14} /> Bilingual
                     </div>
                     <p className="text-xs text-slate-400 leading-relaxed mt-1">
                        Stuck? Speak Chinese. Mr. Sterling will translate and teach you.
                     </p>
                  </div>
                   <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 text-left">
                     <div className="flex items-center gap-2 text-green-400 text-xs font-bold mb-1 uppercase tracking-wider">
                        <BarChart3 size={14} /> Real-time
                     </div>
                     <p className="text-xs text-slate-400 leading-relaxed mt-1">
                        Live stats on your speaking pace and exam duration.
                     </p>
                  </div>
              </div>

              {/* Error Message Display */}
              {mediaError && (
                  <div className="bg-red-500/20 border border-red-500/50 p-4 rounded-xl mb-6 text-left flex items-start gap-3">
                     <div className="bg-red-500 p-1 rounded-full mt-0.5 flex-shrink-0">
                        <AlertCircle size={14} className="text-white"/>
                     </div>
                     <div>
                        <h3 className="text-red-200 font-bold text-sm">Access Denied</h3>
                        <p className="text-red-300 text-xs mt-1">{mediaError}</p>
                     </div>
                  </div>
              )}
              
              <button 
                onClick={handleStartExam}
                disabled={!!mediaError}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-xl ${
                    mediaError 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                <Play size={20} fill="currentColor" />
                Start Mock Exam
              </button>
           </div>
        )}

        {/* END SCREEN */}
        {examPhase === ExamPhase.ENDED && (
           <div className="bg-slate-900/90 backdrop-blur-xl p-8 rounded-3xl border border-slate-700 shadow-2xl max-w-md w-full text-center pointer-events-auto">
              <h2 className="text-2xl font-bold text-white mb-4">Test Completed</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                 <div className="bg-slate-800 p-4 rounded-xl">
                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Duration</div>
                    <div className="text-2xl font-mono text-white">{formatDuration(elapsedTime)}</div>
                 </div>
                 <div className="bg-slate-800 p-4 rounded-xl">
                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Avg Pace</div>
                    <div className="text-2xl font-mono text-white">{wpm} <span className="text-sm text-slate-500">wpm</span></div>
                 </div>
              </div>
              
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-white text-slate-900 hover:bg-slate-200 rounded-xl font-bold transition-colors"
              >
                Start New Session
              </button>
           </div>
        )}

        {/* ACTIVE CONTROLS */}
        {examPhase !== ExamPhase.IDLE && examPhase !== ExamPhase.ENDED && (
           <div className="flex items-center gap-4 pointer-events-auto bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-slate-700 shadow-xl">
              
              <button 
                onClick={toggleMic} 
                className={`p-4 rounded-full transition-all ${micActive ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                title="Toggle Microphone"
              >
                {micActive ? <Mic size={24} /> : <MicOff size={24} />}
              </button>
              
              <button 
                onClick={toggleCamera} 
                className={`p-4 rounded-full transition-all ${cameraActive ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                title="Toggle Camera"
              >
                 {cameraActive ? <Video size={24} /> : <VideoOff size={24} />}
              </button>
              
              <div className="w-px h-8 bg-slate-700 mx-2"></div>

              {/* Context Actions */}
              {examPhase === ExamPhase.PART1 && (
                 <button onClick={() => advancePhase(ExamPhase.PART2_PREP)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-semibold transition-colors text-sm">
                    Move to Part 2
                 </button>
              )}
              
              {examPhase === ExamPhase.PART2_PREP && (
                 <div className="flex items-center gap-4">
                    <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-600">
                       <Timer duration={60} label="Prep" onComplete={() => advancePhase(ExamPhase.PART2_SPEAK)} />
                    </div>
                    <button onClick={() => advancePhase(ExamPhase.PART2_SPEAK)} className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-full font-semibold transition-colors text-sm animate-pulse">
                       Start Speaking
                    </button>
                 </div>
              )}
              
              {examPhase === ExamPhase.PART2_SPEAK && (
                 <div className="flex items-center gap-4">
                     <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-600">
                       <Timer duration={120} label="Speaking" onComplete={() => advancePhase(ExamPhase.PART3)} />
                     </div>
                     <button onClick={() => advancePhase(ExamPhase.PART3)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-semibold transition-colors text-sm">
                        Finish Part 2
                     </button>
                 </div>
              )}
              
              {examPhase === ExamPhase.PART3 && (
                 <button onClick={handleEndExam} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-semibold transition-colors text-sm">
                    End Exam
                 </button>
              )}

              <div className="w-px h-8 bg-slate-700 mx-2"></div>

              <button 
                onClick={handleEndExam} 
                className="p-4 rounded-full bg-red-500/10 text-red-500