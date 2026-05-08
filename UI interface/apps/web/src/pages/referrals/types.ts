export type ChartInsights = {
  peakRequested: { day: string; value: number } | null;
  receivedDays: number;
};

export type CreateRecordForm = {
  company: string;
  request_log: string;
  request_date: string;
  request_link: string;
  referred_by_name: string;
  comment: string;
};

export type CreateReferralForm = {
  company: string;
  request_log: string;
  request_date: string;
  request_link: string;
  referred_by_name: string;
  comment: string;
  keyword_matching: string;
  source: string;
};
