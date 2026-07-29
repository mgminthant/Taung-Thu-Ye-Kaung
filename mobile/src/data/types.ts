export type AgricultureQaRecord = {
  id: string;
  crop: string;
  topic: string;
  symptoms: string[];
  possible_causes: string[];
  solution: string;
  region: string;
  source: string;
  language: string;
  verified: boolean;
  question: string;
  answer: string;
};
