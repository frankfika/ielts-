export enum ExamPhase {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  PART1 = 'PART1', // Introduction & Interview
  PART2_PREP = 'PART2_PREP', // Cue Card Preparation (1 min)
  PART2_SPEAK = 'PART2_SPEAK', // Long Turn (2 mins)
  PART3 = 'PART3', // Discussion
  FEEDBACK = 'FEEDBACK', // Feedback & Analysis
  ENDED = 'ENDED'
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
}

export interface AudioVisualizerData {
  volume: number;
}