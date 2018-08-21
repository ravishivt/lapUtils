import { getDomain } from 'tldjs';

export type LapRole = 'Admin' | 'Standard' | 'Reseller';
export interface User {
  email: string;
  lapRole: LapRole | null;
  subDomain: string;
  tld: string;
}
export interface LapUser {
  Role: LapRole;
  Email: string;
}
export interface LapCompany {
  ID: number;
  Name: string;
  UsersList: Array<LapUser>;
}
export interface LapUserCompanyAssociation {
  companyId: number;
  companyName: string;
  role: LapRole;
}

export const getSubDomainForUser = (email: string): string =>
  email.substring(email.lastIndexOf('@') + 1);

const doAllCompanyTLDsExistInRA = (company: LapCompany, tlds: Array<string>) => {
  const companyTlds = getLapCompanyTlds(company);
  return companyTlds.length > 0 && companyTlds.every(tld => tlds.indexOf(tld) !== -1);
};

export const getLapCompanyTlds = (lapCompany: LapCompany): Array<string> => {
  const tlds = [
    ...lapCompany.UsersList.reduce((adminTlds: Set<string>, lapUser) => {
      if (lapUser.Role === 'Admin') {
        adminTlds.add(getDomain(getSubDomainForUser(lapUser.Email)));
      }
      return adminTlds;
    }, new Set()),
  ];
  // if (tlds.length > 1) {
  //   throw new Error('Company has multiple TLDs');
  // } else if (tlds.length === 0) {
  //   throw new Error('Company has no admins');
  // } else {
  //   return tlds;
  // }
  return tlds;
};

export const getLapCompanyForUser = (
  lapApiResponse: Array<LapCompany>,
  userEmail: string,
  rootAccountTlds: Array<string>,
): LapUserCompanyAssociation | null => {
  const companyHash: { [key: number]: LapCompany } = {};
  // Iterate over list of companies and transform it into a list of user-company associations.
  //   Array.reduce + Array.some allows us to "map" and "filter" array in one  iteration instead of two.
  const companies = lapApiResponse.reduce(
    (result: Array<LapUserCompanyAssociation>, lapCompany) => {
      // some - Iterate over company's user list until user is found.
      // Disregard any user-company associations that aren't standard or admin (e.g. reseller).
      lapCompany.UsersList.some(lapCompanyUser => {
        if (
          lapCompanyUser.Email === userEmail &&
          (lapCompanyUser.Role === 'Admin' || lapCompanyUser.Role === 'Standard')
        ) {
          companyHash[lapCompany.ID] = lapCompany;
          result.push({
            companyId: lapCompany.ID,
            companyName: lapCompany.Name,
            role: lapCompanyUser.Role,
          });
          return true;
        }
      });
      return result;
    },
    [],
  );
  if (companies.length > 0) {
    const adminCompanies = companies.filter(company => company.role === 'Admin');
    // Companies that user is an ADMIN to take precedence over other associations.
    if (adminCompanies.length > 0) {
      if (adminCompanies.length === 1) {
        // Make sure the single ADMIN company has no foreign TLDs.
        if (doAllCompanyTLDsExistInRA(companyHash[adminCompanies[0].companyId], rootAccountTlds)) {
          return adminCompanies[0];
        } else {
          throw new Error(
            `Error 19-3: User has one LAP company association as ADMIN but that company has foreign TLDs not in the root account's TLDs`,
          );
        }
      } else if (adminCompanies.length > 1) {
        throw new Error('Error 19-1: User has multiple LAP company associations as ADMIN');
      }
    }
    // If no ADMIN associations, process the STANDARD associations.
    else {
      if (companies.length === 1) {
        // Make sure the single STANDARD company has no foreign TLDs.
        if (doAllCompanyTLDsExistInRA(companyHash[companies[0].companyId], rootAccountTlds)) {
          return companies[0];
        } else {
          throw new Error(
            `Error 19-4: User has one LAP company association as STANDARD but that company has foreign TLDs not in the root account's TLDs`,
          );
        }
      }
      if (companies.length > 0) {
        // Attempt to find a single company where there are no foreign TLDs.  If multiple match, error.
        const companiesWithAllTLDsInRA = companies.filter(company =>
          doAllCompanyTLDsExistInRA(companyHash[company.companyId], rootAccountTlds),
        );
        if (companiesWithAllTLDsInRA.length === 1) {
          return companiesWithAllTLDsInRA[0];
        } else {
          throw new Error('Error 19-2: User has multiple LAP company associations as STANDARD');
        }
      }
    }
  }
  // User had no relevant data in LAP, treat as new user.
  return null;
};
