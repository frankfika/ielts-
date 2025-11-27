import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { MODEL_NAME, SYSTEM_INSTRUCTION, VOICE_NAME } from '../constants';
import { createPcmBlob, base64ToUint8Array, decodeAudioData } from './audioUtils';

export class GeminiLiveClient {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextStartTime: number = 0;
  private isConnected: boolean = false;
  private session: any = null;
  
  public onAudioLevel: ((level: number) => void) | null = null;
  public onResponseAudioLevel: ((level: number) => void) | null = null;
  public onTranscription: ((text: string, isUser: boolean) => void) | null = null;

  constructor() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY not found in environment variables");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(stream: MediaStream) {
    if (this.isConnected) return;

    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    // Reset output timing
    this.nextStartTime = this.outputAudioContext.currentTime;

    const sessionPromise = this.ai.live.connect({
      model: MODEL_NAME,
      callbacks: {
        onopen: () => {
          console.log("Gemini Live Connected");
          this.isConnected = true;
          this.startAudioInput(stream, sessionPromise);
        },
        onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
        onclose: () => {
          console.log("Gemini Live Closed");
          this.isConnected = false;
        },
        onerror: (err) => {
          console.error("Gemini Live Error", err);
          this.isConnected = false;
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } }
        },
        systemInstruction: SYSTEM_INSTRUCTION,
        inputAudioTranscription: {}, 
        outputAudioTranscription: {},
      }
    });

    this.session = sessionPromise;
    return sessionPromise;
  }

  private startAudioInput(stream: MediaStream, sessionPromise: Promise<any>) {
    if (!this.inputAudioContext) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    // Reduced buffer size from 4096 to 2048 to decrease input latency (approx 128ms)
    this.processor = this.inputAudioContext.createScriptProcessor(2048, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      if (this.onAudioLevel) this.onAudioLevel(rms);

      // Create PCM blob and send
      const pcmBlob = createPcmBlob(inputData);
      sessionPromise.then(session => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    // Handle Transcriptions
    if (message.serverContent?.inputTranscription?.text) {
        if (this.onTranscription) this.onTranscription(message.serverContent.inputTranscription.text, true);
    }
    if (message.serverContent?.outputTranscription?.text) {
        if (this.onTranscription) this.onTranscription(message.serverContent.outputTranscription.text, false);
    }

    // Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
      try {
        const audioBytes = base64ToUint8Array(base64Audio);
        const audioBuffer = await decodeAudioData(audioBytes, this.outputAudioContext, 24000, 1);
        
        // Calculate audio level for AI visualizer (approximate from first chunk of buffer)
        const channelData = audioBuffer.getChannelData(0);
        let sum = 0;
        const sampleSize = Math.min(channelData.length, 1000);
        for(let i=0; i<sampleSize; i++) sum += channelData[i] * channelData[i];
        const rms = Math.sqrt(sum / sampleSize);
        if (this.onResponseAudioLevel) this.onResponseAudioLevel(rms * 5); // Boost gain for visual

        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputAudioContext.destination);
        
        // Schedule playback
        const currentTime = this.outputAudioContext.currentTime;
        if (this.nextStartTime < currentTime) {
          this.nextStartTime = currentTime;
        }
        
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;

      } catch (e) {
        console.error("Error decoding audio", e);
      }
    }

    if (message.serverContent?.interrupted) {
      // Clear queue if interrupted
      this.nextStartTime = this.outputAudioContext?.currentTime || 0;
    }
  }

  disconnect() {
    this.isConnected = false;
    
    if (this.session) {
      this.session.then((s: any) => { 
          if(s.close) s.close(); 
      });
    }

    if (this.inputSource) this.inputSource.disconnect();
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
    }
    
    if (this.inputAudioContext) this.inputAudioContext.close();
    if (this.outputAudioContext) this.outputAudioContext.close();

    this.inputAudioContext = null;
    this.outputAudioContext = null;
  }
}