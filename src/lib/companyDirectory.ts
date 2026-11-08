import generatedDirectory from '../data/company-directory.generated.json';

export interface CompanyLink {
  name: string;
  url: string;
}

export const companyDirectory = generatedDirectory.companies as CompanyLink[];
