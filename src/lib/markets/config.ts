export interface MarketConfig {
  code: string;                    // 'SE', 'GB', 'US', etc.
  name: string;                    // 'Sweden'
  flag: string;                    // '🇸🇪'
  languages: string[];             // ['sv', 'en']
  defaultLanguage: string;         // 'sv'
  currency: string;                // 'SEK'
  jobSources: {
    primary: 'jobtechdev' | 'adzuna' | 'none';
    fallback?: 'adzuna';
    adzunaCountry?: string;        // Adzuna country code (e.g., 'gb', 'us')
  };
  atsAdapters: string[];           // ['teamtailor', 'varbi', 'greenhouse', ...]
  resumeFormats: {
    default: string;               // 'swedish' | 'international'
    available: string[];           // ['swedish', 'international']
  };
  applicationNorms: {
    coverLetterExpected: boolean;
    coverLetterName: string;       // 'Personligt brev', 'Cover Letter', 'Anschreiben'
    photoOnCV: 'common' | 'optional' | 'discouraged';
    cvPages: number;               // Typical page count
    referencesOnCV: boolean;
  };
}

export const MARKETS: MarketConfig[] = [
  {
    code: 'SE',
    name: 'Sweden',
    flag: '🇸🇪',
    languages: ['sv', 'en'],
    defaultLanguage: 'sv',
    currency: 'SEK',
    jobSources: {
      primary: 'jobtechdev',
      fallback: 'adzuna',
      adzunaCountry: 'se',
    },
    atsAdapters: ['teamtailor', 'varbi', 'greenhouse', 'lever', 'workday', 'linkedin'],
    resumeFormats: {
      default: 'swedish',
      available: ['swedish', 'international'],
    },
    applicationNorms: {
      coverLetterExpected: true,
      coverLetterName: 'Personligt brev',
      photoOnCV: 'common',
      cvPages: 2,
      referencesOnCV: true,
    },
  },
  {
    code: 'NO',
    name: 'Norway',
    flag: '🇳🇴',
    languages: ['no', 'en'],
    defaultLanguage: 'no',
    currency: 'NOK',
    jobSources: {
      primary: 'adzuna',
      adzunaCountry: 'no',
    },
    atsAdapters: ['greenhouse', 'lever', 'workday', 'teamtailor', 'linkedin'],
    resumeFormats: {
      default: 'international',
      available: ['international'],
    },
    applicationNorms: {
      coverLetterExpected: true,
      coverLetterName: 'Søknadsbrev',
      photoOnCV: 'optional',
      cvPages: 2,
      referencesOnCV: true,
    },
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    languages: ['en'],
    defaultLanguage: 'en',
    currency: 'GBP',
    jobSources: {
      primary: 'adzuna',
      adzunaCountry: 'gb',
    },
    atsAdapters: ['greenhouse', 'lever', 'workday', 'linkedin'],
    resumeFormats: {
      default: 'international',
      available: ['international'],
    },
    applicationNorms: {
      coverLetterExpected: true,
      coverLetterName: 'Cover Letter',
      photoOnCV: 'discouraged',
      cvPages: 2,
      referencesOnCV: false,
    },
  },
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    languages: ['en'],
    defaultLanguage: 'en',
    currency: 'USD',
    jobSources: {
      primary: 'adzuna',
      adzunaCountry: 'us',
    },
    atsAdapters: ['greenhouse', 'lever', 'workday', 'linkedin'],
    resumeFormats: {
      default: 'international',
      available: ['international'],
    },
    applicationNorms: {
      coverLetterExpected: false,
      coverLetterName: 'Cover Letter',
      photoOnCV: 'discouraged',
      cvPages: 1,
      referencesOnCV: false,
    },
  },
  {
    code: 'DE',
    name: 'Germany',
    flag: '🇩🇪',
    languages: ['de', 'en'],
    defaultLanguage: 'de',
    currency: 'EUR',
    jobSources: {
      primary: 'adzuna',
      adzunaCountry: 'de',
    },
    atsAdapters: ['greenhouse', 'lever', 'workday', 'linkedin'],
    resumeFormats: {
      default: 'international',
      available: ['international'],
    },
    applicationNorms: {
      coverLetterExpected: true,
      coverLetterName: 'Anschreiben',
      photoOnCV: 'common',
      cvPages: 2,
      referencesOnCV: false,
    },
  },
];
