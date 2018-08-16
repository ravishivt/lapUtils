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

export const getUsersSubDomain = (email: string): string =>
  email.substring(email.lastIndexOf('@') + 1);

const doesCompanyMatchUsersTlds = (company: LapCompany, tlds: Array<string>) => {
  const companyTlds = getLapCompanyTlds(company);
  return companyTlds.length > 0 && companyTlds.every(tld => tlds.indexOf(tld) !== -1);
};

export const getLapCompanyTlds = (lapCompany: LapCompany): Array<string> => {
  const tlds = [
    ...lapCompany.UsersList.reduce((adminTlds: Set<string>, lapUser) => {
      if (lapUser.Role === 'Admin') {
        adminTlds.add(getDomain(getUsersSubDomain(lapUser.Email)));
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

export const getUsersLapCompany = (
  lapApiResponse: Array<LapCompany>,
  userEmail: string,
  rootAccountTlds: Array<string>,
): LapUserCompanyAssociation | null => {
  const companyHash: { [key: number]: LapCompany } = {};
  // Iterate over list of companies and transform it into a list of user-company associations.
  //   Array.reduce + Array.some allows us to "map" and "filter" array in one  iteration instead of two.
  const usersCompanies = lapApiResponse.reduce(
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
        return false;
      });
      return result;
    },
    [],
  );
  if (usersCompanies.length > 0) {
    const usersAdminCompanies = usersCompanies.filter(company => company.role === 'Admin');
    // Companies that user is an ADMIN to take precedence over other associations.
    if (usersAdminCompanies.length > 0) {
      if (usersAdminCompanies.length === 1) {
        if (
          doesCompanyMatchUsersTlds(companyHash[usersAdminCompanies[0].companyId], rootAccountTlds)
        ) {
          return usersAdminCompanies[0];
        } else {
          throw new Error(
            `Error 19-3: User has one LAP company association as ADMIN but that company has TLDs not in the root account's TLDs`,
          );
        }
      } else if (usersAdminCompanies.length > 1) {
        throw new Error('Error 19-1: User has multiple LAP company associations as ADMIN');
      }
    }
    // If no ADMIN associations, process the STANDARD associations.
    else {
      if (usersCompanies.length === 1) {
        if (doesCompanyMatchUsersTlds(companyHash[usersCompanies[0].companyId], rootAccountTlds)) {
          return usersCompanies[0];
        } else {
          throw new Error(
            `Error 19-4: User has one LAP company association as STANDARD but that company has TLDs not in the root account's TLDs`,
          );
        }
      }
      if (usersCompanies.length > 0) {
        //
        // const usersCompaniesMatchingUsersTlds = usersCompanies.reduce(
        //   (companies: Array<LapUserCompanyAssociation>, company) => {
        //     if (doesCompanyMatchUsersTlds(companyHash[company.companyId], rootAccountTlds)) {
        //       companies.push(company);
        //     }
        //     return companies;
        //   },
        //   [],
        // );
        const usersCompaniesMatchingUsersTlds = usersCompanies.filter(company =>
          doesCompanyMatchUsersTlds(companyHash[company.companyId], rootAccountTlds),
        );
        if (usersCompaniesMatchingUsersTlds.length === 1) {
          return usersCompaniesMatchingUsersTlds[0];
        } else {
          throw new Error('Error 19-2: User has multiple LAP company associations as STANDARD');
        }
      }
    }
  }
  // User had no relevant data in LAP, treat as new user.
  return null;
};
