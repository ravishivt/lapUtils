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

export const getUserSubDomain = (email: string): string =>
  email.substring(email.lastIndexOf('@') + 1);

const doesCompanyMatchRATlds = (company: LapCompany, tlds: Array<string>) => {
  const companyTlds = getLapCompanyTlds(company);
  return companyTlds.length > 0 && companyTlds.every(tld => tlds.indexOf(tld) !== -1);
};

export const getLapCompanyTlds = (lapCompany: LapCompany): Array<string> => {
  const tlds = [
    ...lapCompany.UsersList.reduce((adminTlds: Set<string>, lapUser) => {
      if (lapUser.Role === 'Admin') {
        adminTlds.add(getDomain(getUserSubDomain(lapUser.Email)));
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

export const getUserLapCompany = (
  lapApiResponse: Array<LapCompany>,
  userEmail: string,
  rootAccountTlds: Array<string>,
): LapUserCompanyAssociation | null => {
  const companyHash: { [key: number]: LapCompany } = {};
  // Iterate over list of companies and transform it into a list of user-company associations.
  //   Array.reduce + Array.some allows us to "map" and "filter" array in one  iteration instead of two.
  const userCompanies = lapApiResponse.reduce(
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
  if (userCompanies.length > 0) {
    const userAdminCompanies = userCompanies.filter(company => company.role === 'Admin');
    // Companies that user is an ADMIN to take precedence over other associations.
    if (userAdminCompanies.length > 0) {
      if (userAdminCompanies.length === 1) {
        if (doesCompanyMatchRATlds(companyHash[userAdminCompanies[0].companyId], rootAccountTlds)) {
          return userAdminCompanies[0];
        } else {
          throw new Error(
            `Error 19-3: User has one LAP company association as ADMIN but that company has TLDs not in the root account's TLDs`,
          );
        }
      } else if (userAdminCompanies.length > 1) {
        throw new Error('Error 19-1: User has multiple LAP company associations as ADMIN');
      }
    }
    // If no ADMIN associations, process the STANDARD associations.
    else {
      if (userCompanies.length === 1) {
        if (doesCompanyMatchRATlds(companyHash[userCompanies[0].companyId], rootAccountTlds)) {
          return userCompanies[0];
        } else {
          throw new Error(
            `Error 19-4: User has one LAP company association as STANDARD but that company has TLDs not in the root account's TLDs`,
          );
        }
      }
      if (userCompanies.length > 0) {
        //
        // const userCompaniesMatchingUserTlds = userCompanies.reduce(
        //   (companies: Array<LapUserCompanyAssociation>, company) => {
        //     if (doesCompanyMatchRATlds(companyHash[company.companyId], rootAccountTlds)) {
        //       companies.push(company);
        //     }
        //     return companies;
        //   },
        //   [],
        // );
        const userCompaniesMatchingUserTlds = userCompanies.filter(company =>
          doesCompanyMatchRATlds(companyHash[company.companyId], rootAccountTlds),
        );
        if (userCompaniesMatchingUserTlds.length === 1) {
          return userCompaniesMatchingUserTlds[0];
        } else {
          throw new Error('Error 19-2: User has multiple LAP company associations as STANDARD');
        }
      }
    }
  }
  // User had no relevant data in LAP, treat as new user.
  return null;
};
